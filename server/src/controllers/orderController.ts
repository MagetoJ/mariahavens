import { Request, Response } from 'express';
import db from '../db';
import { validateStaffPinForOrder } from '../utils/validation';
import { WebSocketService } from '../services/websocket';
import { isPast8AMKenyanTime } from '../utils/time';

let webSocketService: WebSocketService;

export const setWebSocketService = (wsService: WebSocketService) => {
  webSocketService = wsService;
};

// Create new order with PIN validation
export const createOrder = async (req: Request, res: Response) => {
  const { items, staff_username, pin, payment_method = 'cash', room_id, ...orderData } = req.body;

  try {
    let staffId = null;
    let staffName = 'Quick POS';

    // Skip PIN validation for bar sales AND self-service (QR) orders
    if (orderData.order_type === 'bar_sale' || orderData.order_type === 'self_service') {
      staffName = orderData.order_type === 'self_service' ? 'Customer (QR)' : 'Bar Staff';
      console.log(`${orderData.order_type} order - no PIN validation required`);
    } else {
      // Validate staff username and PIN for other orders
      if (!staff_username || !pin) {
        return res.status(400).json({ message: 'Staff username and PIN are required' });
      }

      const validation = await validateStaffPinForOrder(staff_username, pin);
      if (!validation.valid || !validation.staffId || !validation.staffName) {
        return res.status(401).json({ message: 'Invalid username or PIN' });
      }

      staffId = validation.staffId;
      staffName = validation.staffName;
      console.log('PIN validated for order by:', staffName);
      
      // Kenyan 8 AM Rollover Logic (8 AM EAT = 5 AM UTC)
      const anchorUTC = new Date();
      anchorUTC.setUTCHours(5, 0, 0, 0);
      
      // If current time is before 8 AM EAT, the previous work window ended at yesterday's 8 AM anchor.
      if (new Date() < anchorUTC) {
        anchorUTC.setUTCDate(anchorUTC.getUTCDate() - 1);
      }

      const staff = await db('staff').where({ id: staffId }).select('requires_clearing').first();
      
      if (staff && staff.requires_clearing) {
        // Block if there is any uncleared data created BEFORE the current anchor point
        const hasOldData = await db('orders')
          .where({ staff_id: staffId, is_cleared: false })
          .andWhere('created_at', '<', anchorUTC)
          .first();
          
        if (hasOldData) {
          return res.status(403).json({ 
            message: 'Action Blocked: Your previous shift receipts have not been cleared. Please see Admin to clear your account before proceeding.',
            blocking_reason: 'uncleared_data'
          });
        }
      }
    }

    // New Receipt Numbering System: MH-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
    const orderPrefix = `MH-${dateStr}-`;

    // Derive the next sequence from the highest order_number used today.
    // Using MAX instead of COUNT means:
    //  - Cleared orders still anchor the sequence (no resets after cash-up)
    //  - A gap in the middle (cancelled order) doesn't cause a collision
    //  - Concurrent inserts are safe: both read MAX, one wins the unique constraint,
    //    the other retries — see the retry loop below.
    const maxResult = await db('orders')
      .where('order_number', 'like', `${orderPrefix}%`)
      .max('order_number as max_order_number')
      .first();

    let sequence = 1;
    if (maxResult?.max_order_number) {
      const lastSeq = parseInt((maxResult.max_order_number as string).split('-')[2], 10);
      if (!isNaN(lastSeq)) sequence = lastSeq + 1;
    }

    const paddedSequence = sequence.toString().padStart(4, '0');
    let orderNumber = `${orderPrefix}${paddedSequence}`;

    let orderId: any;

    // Retry loop: handles the rare race condition where two requests read the same
    // MAX order_number concurrently and both try to insert the same order_number.
    // On a unique-constraint violation (pg error code 23505) we re-derive the next
    // sequence and try once more. Two retries are more than enough in practice.
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {

    // Start DB transaction
    await db.transaction(async trx => {
      // Remove client-sent `id`
      const { id, ...orderToInsert } = orderData;

      // Ensure numeric fields and add order_number
      const safeOrder: any = {
        ...orderToInsert,
        staff_id: staffId,
        order_number: orderNumber, // Use the variable from outer scope
        subtotal: Number(orderToInsert.subtotal || 0),
        total_amount: Number(orderToInsert.total_amount || 0),
        payment_method: payment_method || 'cash',
        is_cleared: false,
        // Set initial status for self-service orders to 'pending' (kitchen needs to accept/see it)
        status: orderData.order_type === 'self_service' ? 'pending' : (orderToInsert.status || 'pending'), 
        created_at: new Date(),
        updated_at: new Date()
      };

      // If it's a room service order from Quick POS
      if (orderData.order_type === 'room_service' && room_id) {
        // Add logic to ensure the room is actually occupied
        const room = await trx('rooms').where({ id: room_id, status: 'occupied' }).first();
        if (!room) throw new Error('Selected room is no longer occupied');
        
        // The order should be marked with the room_id
        safeOrder.room_id = room_id;
        safeOrder.payment_method = 'room_charge'; 
      }

      console.log('Inserting order:', safeOrder);

      // Insert order and get auto-generated ID
      const [insertedOrder] = await trx('orders')
        .insert(safeOrder)
        .returning('id');

      orderId = insertedOrder.id;

      if (!orderId) throw new Error('Failed to create order and get ID');

      // 115. Insert order items and handle inventory deduction (Refactored for Bar Products)
      if (items && items.length > 0) {
        const orderItems = [];
        
        // 1. Pre-fetch products and potential inventory items
        const productIds = items.map((i: any) => i.product_id);
        const orderProducts = await trx('products').whereIn('id', productIds);
        const productMap = new Map(orderProducts.map(p => [p.id, p]));

        const potentialInvIds = new Set<number>();
        items.forEach((i: any) => {
          if (i.inventory_item_id) potentialInvIds.add(i.inventory_item_id);
          const p = productMap.get(i.product_id);
          if (p?.inventory_item_id) potentialInvIds.add(p.inventory_item_id);
          // Compatibility: In bar_sale, product_id is often the inventory_id
          if (orderData.order_type === 'bar_sale') potentialInvIds.add(i.product_id);
        });

        const inventoryItems = potentialInvIds.size > 0 
          ? await trx('inventory_items').whereIn('id', Array.from(potentialInvIds)).where({ is_active: true }).forUpdate()
          : [];
        
        const invMap = new Map(inventoryItems.map(i => [i.id, i]));

        for (const item of items) {
          const product = productMap.get(item.product_id);
          
          // Determine the correct inventory link
          let invId = item.inventory_item_id || product?.inventory_item_id;
          if (!invId && orderData.order_type === 'bar_sale') {
            invId = item.product_id;
          }

          const inventoryItem = invId ? invMap.get(invId) : null;
          let costPrice = 0;
          let finalInventoryId = null;

          // RESTRUCTURED: Only deduct stock for "bar" type inventory items
          if (inventoryItem && inventoryItem.inventory_type === 'bar') {
            costPrice = inventoryItem.cost_per_unit || 0;
            finalInventoryId = inventoryItem.id;

            const requestedQty = Number(item.quantity);
            const currentStock = Number(inventoryItem.current_stock);
            
            // Check if stock was already deducted during "add to cart"
            if (!item.is_stock_deducted) {
              const newStock = currentStock - requestedQty;

              if (newStock < 0) {
                throw new Error(`Out of Stock: ${inventoryItem.name} has only ${currentStock} remaining.`);
              }

              // Update Stock
              await trx('inventory_items')
                .where({ id: inventoryItem.id })
                .update({ 
                  current_stock: newStock, 
                  updated_at: new Date() 
                });
                
              // Update local map for multi-item orders
              inventoryItem.current_stock = newStock;
            } else {
              console.log(`ℹ️ Stock already pre-deducted for: ${inventoryItem.name}`);
            }

            // Log Transaction (always log for orders)
            await trx('inventory_log').insert({
              inventory_item_id: inventoryItem.id,
              action: 'sale',
              quantity_change: -requestedQty,
              reference_id: orderId,
              reference_type: 'order',
              logged_by: staffId,
              notes: `Bar Sale: ${inventoryItem.name} (Order: ${orderNumber})`,
              created_at: new Date()
            });

            console.log(`✅ Sale Logged: ${inventoryItem.name} (-${requestedQty})`);
          } else {
            // Strict requirement for bar/room sales
            if (orderData.order_type === 'bar_sale' || orderData.order_type === 'room_service') {
              const name = product?.name || item.name || 'Unknown';
              console.error(`❌ Inventory Mapping Missing: ${name} (ID: ${item.product_id})`);
              throw new Error(`Technical Error: "${name}" is not linked to a bar inventory item.`);
            }
            
            // For other types, we just use the product cost if available
            costPrice = product?.cost || 0;
          }

          orderItems.push({
            order_id: orderId,
            product_id: item.product_id,
            inventory_item_id: finalInventoryId,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            cost_price: costPrice,
            total_price: Number(item.total_price),
            notes: item.notes || '',
          });
        }

        await trx('order_items').insert(orderItems);
      }

      // Create payment record
      if (safeOrder.payment_method) {
        await trx('payments').insert({
          order_id: orderId,
          payment_method: safeOrder.payment_method,
          amount: Number(orderToInsert.total_amount || 0),
          status: safeOrder.payment_method === 'room_charge' ? 'completed' : 'pending' // Room charges are "completed" in terms of order payment
        });
      }
    });

    // Broadcast to kitchen with full order data
    if (webSocketService) {
      try {
        const fullOrder = await db('orders').where({ id: orderId }).first();
        if (fullOrder) {
          fullOrder.items = await db('order_items')
            .join('products', 'order_items.product_id', 'products.id')
            .where('order_id', orderId)
            .select('order_items.quantity', 'products.name as product_name', 'order_items.notes');
          
          webSocketService.broadcastToKitchens({ 
            type: 'new_order',
            order: fullOrder
          });
        }
      } catch (wsErr) {
        console.error('WebSocket broadcast error:', wsErr);
      }
    }

    res.status(201).json({
      message: 'Order created successfully',
      order_id: orderId,
      order_number: orderNumber,
      staff_name: staffName,
    });

    return; // success — exit retry loop

      } catch (err) {
        // On duplicate order_number, re-derive and retry
        const pgErr = err as any;
        if (pgErr?.code === '23505' && pgErr?.constraint === 'orders_order_number_key' && attempt < MAX_RETRIES) {
          console.warn(`⚠️ Duplicate order_number collision on attempt ${attempt}, retrying...`);

          // Re-derive the next available sequence before next attempt
          const retryMax = await db('orders')
            .where('order_number', 'like', `${orderPrefix}%`)
            .max('order_number as max_order_number')
            .first();

          let retrySeq = 1;
          if (retryMax?.max_order_number) {
            const last = parseInt((retryMax.max_order_number as string).split('-')[2], 10);
            if (!isNaN(last)) retrySeq = last + 1;
          }
          orderNumber = `${orderPrefix}${retrySeq.toString().padStart(4, '0')}`;
          continue; // retry
        }

        // Any other error — surface it
        console.error('Order creation error:', err);
        console.error('Error details:', {
          message: (err as Error).message,
          stack: (err as Error).stack,
          name: (err as Error).name
        });
        return res.status(500).json({ 
          message: 'Failed to create order',
          error: (err as Error).message 
        });
      }
    } // end retry loop

  } catch (err) {
    console.error('Order creation error (outer):', err);
    res.status(500).json({ 
      message: 'Failed to create order',
      error: (err as Error).message 
    });
  }
};

// Get orders with filtering
export const getOrders = async (req: Request, res: Response) => {
  try {
    const { 
      status, 
      order_type, 
      start_date, 
      end_date,
      limit = 50,
      offset = 0 
    } = req.query;

    let query = db('orders')
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Apply filters
    if (status) {
      query = query.where('status', status);
    }
    
    if (order_type) {
      query = query.where('order_type', order_type);
    }
    
    if (start_date && end_date) {
      query = query.whereBetween('created_at', [start_date, end_date]);
    }

    const orders = await query;

    if (orders.length === 0) {
      return res.json([]);
    }

    const orderIds = orders.map(o => o.id);

    // Get all order items in one query
    const allItems = await db('order_items')
      .leftJoin('products', 'order_items.product_id', 'products.id')
      .whereIn('order_id', orderIds)
      .select(
        'order_items.*',
        'products.name as product_name'
      );

    // Group items by order_id
    const itemsByOrder = allItems.reduce((acc: any, item: any) => {
      if (!acc[item.order_id]) {
        acc[item.order_id] = [];
      }
      acc[item.order_id].push(item);
      return acc;
    }, {});

    // Attach items to orders
    const ordersWithItems = orders.map(order => ({
      ...order,
      items: itemsByOrder[order.id] || []
    }));

    res.json(ordersWithItems);

  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ message: 'Error fetching orders' });
  }
};

// Get order by ID
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await db('orders').where({ id }).first();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Get order items
    order.items = await db('order_items')
      .leftJoin('products', 'order_items.product_id', 'products.id')
      .where('order_id', id)
      .select(
        'order_items.*',
        'products.name as product_name'
      );

    res.json(order);

  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({ message: 'Error fetching order' });
  }
};

// Update order status
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const [updatedOrder] = await db('orders')
      .where({ id })
      .update({ 
        status, 
        updated_at: new Date() 
      })
      .returning('*');

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Broadcast status update to kitchen displays
    if (webSocketService) {
      webSocketService.broadcastToKitchens({
        type: 'order_status_update',
        orderId: id,
        status: status,
        order: updatedOrder
      });
    }

    res.json(updatedOrder);

  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ message: 'Error updating order status' });
  }
};

// Mark order as completed when receipt is printed
export const markOrderAsCompleted = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await db('orders').where({ id }).first();
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const [updatedOrder] = await db('orders')
      .where({ id })
      .update({ 
        status: 'completed', 
        updated_at: new Date() 
      })
      .returning('*');

    console.log(`✅ Order ${id} marked as completed for receipt printing`);
    res.json({ message: 'Order marked as completed', order: updatedOrder });

  } catch (err) {
    console.error('Error marking order as completed:', err);
    res.status(500).json({ message: 'Error marking order as completed' });
  }
};

// NEW: Complete self-service order by waiter
export const completeSelfServiceOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { transaction_code, payment_method, waiter_id } = req.body;

    if (!waiter_id) {
      return res.status(400).json({ message: 'Waiter ID is required' });
    }

    // Start transaction
    const result = await db.transaction(async trx => {
      // 1. Update order
      const [order] = await trx('orders')
        .where({ id })
        .update({
          status: 'completed',
          payment_status: 'paid',
          completed_by: waiter_id,
          updated_at: new Date()
        })
        .returning('*');

      if (!order) {
        throw new Error('Order not found');
      }

      // 2. Update payment
      await trx('payments')
        .where({ order_id: id })
        .update({
          status: 'completed',
          payment_method: payment_method || order.payment_method,
          transaction_code: transaction_code || null,
          updated_at: new Date()
        });

      return order;
    });

    // 3. Broadcast
    if (webSocketService) {
      webSocketService.broadcastToKitchens({
        type: 'order_status_update',
        orderId: id,
        status: 'completed',
        order: result
      });
    }

    res.json({ message: 'Order completed and payment verified', order: result });

  } catch (err) {
    console.error('Error completing self-service order:', err);
    res.status(500).json({ message: (err as Error).message || 'Error completing order' });
  }
};

// Get staff member's recent orders (for My Recent Orders feature)
export const getStaffRecentOrders = async (req: Request, res: Response) => {
  try {
    const staffId = req.user?.id;
    if (!staffId) {
      return res.status(401).json({ message: 'Unauthorized - No staff ID' });
    }

    const { limit = 20, offset = 0 } = req.query;

    const orders = await db('orders')
      .where('staff_id', staffId)
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    if (orders.length === 0) {
      return res.json([]);
    }

    const orderIds = orders.map(o => o.id);

    // Get order items in one query
    const allItems = await db('order_items')
      .leftJoin('products', 'order_items.product_id', 'products.id')
      .whereIn('order_id', orderIds)
      .select(
        'order_items.*',
        'products.name as product_name'
      );

    // Get payment details in one query
    const allPayments = await db('payments')
      .whereIn('order_id', orderIds);

    // Group items and payments
    const itemsByOrder = allItems.reduce((acc: any, item: any) => {
      if (!acc[item.order_id]) acc[item.order_id] = [];
      acc[item.order_id].push(item);
      return acc;
    }, {});

    const paymentsByOrder = allPayments.reduce((acc: any, payment: any) => {
      acc[payment.order_id] = payment;
      return acc;
    }, {});

    // Attach to orders
    const ordersWithDetails = orders.map(order => {
      const payment = paymentsByOrder[order.id];
      return {
        ...order,
        items: itemsByOrder[order.id] || [],
        payment_method: payment?.payment_method || order.payment_method || 'cash',
        transaction_code: payment?.transaction_code || null
      };
    });

    res.json(ordersWithDetails);

  } catch (err) {
    console.error('Error fetching staff recent orders:', err);
    res.status(500).json({ message: 'Error fetching recent orders' });
  }
};

// Get ALL recent orders (for Receptionist/Admin view - no staff_id filter)
export const getAllRecentOrders = async (req: Request, res: Response) => {
  try {
    // Only allow authorized roles
    const authorizedRoles = ['admin', 'manager', 'receptionist', 'cashier'];
    if (!req.user || !authorizedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Unauthorized access to all orders' });
    }

    const { limit = 20, offset = 0 } = req.query;

    const orders = await db('orders')
      .select(
        'orders.*', 
        'staff.name as staff_name',
        'completed_staff.name as completed_by_name'
      )
      .leftJoin('staff', 'orders.staff_id', 'staff.id')
      .leftJoin('staff as completed_staff', 'orders.completed_by', 'completed_staff.id')
      .orderBy('orders.created_at', 'desc')
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    if (orders.length === 0) {
      return res.json([]);
    }

    const orderIds = orders.map(o => o.id);

    // Get order items in one query
    const allItems = await db('order_items')
      .leftJoin('products', 'order_items.product_id', 'products.id')
      .whereIn('order_id', orderIds)
      .select(
        'order_items.*',
        'products.name as product_name'
      );

    // Get payments in one query
    const allPayments = await db('payments')
      .whereIn('order_id', orderIds);

    // Group items and payments
    const itemsByOrder = allItems.reduce((acc: any, item: any) => {
      if (!acc[item.order_id]) acc[item.order_id] = [];
      acc[item.order_id].push(item);
      return acc;
    }, {});

    const paymentsByOrder = allPayments.reduce((acc: any, payment: any) => {
      acc[payment.order_id] = payment;
      return acc;
    }, {});

    // Attach to orders
    const ordersWithDetails = orders.map(order => {
      const payment = paymentsByOrder[order.id];
      return {
        ...order,
        items: itemsByOrder[order.id] || [],
        payment_method: payment?.payment_method || order.payment_method || 'cash',
        transaction_code: payment?.transaction_code || null
      };
    });

    res.json(ordersWithDetails);

  } catch (err) {
    console.error('Error fetching all recent orders:', err);
    res.status(500).json({ message: 'Error fetching recent orders' });
  }
};

// Validate staff PIN for order
export const validatePin = async (req: Request, res: Response) => {
  try {
    const { username, pin } = req.body;
    
    if (!username || !pin) {
      return res.status(400).json({ message: 'Username and PIN are required' });
    }
    
    const validation = await validateStaffPinForOrder(username, pin);
    if (!validation.valid) {
      return res.status(401).json({ message: 'Invalid username or PIN' });
    }

    const user = await db('staff').where({ username }).first();
    const { password: _, pin: __, ...userWithoutSensitiveData } = user;
    
    res.json(userWithoutSensitiveData);

  } catch (err) {
    console.error('Error validating PIN:', err);
    res.status(500).json({ message: 'Error validating PIN' });
  }
};