import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db';

// Get all staff members
export const getStaff = async (req: Request, res: Response) => {
  try {
    // Try to select all columns including email, fall back if email column doesn't exist
    try {
      const staff = await db('staff')
        .where({ is_active: true })
        .select('id', 'employee_id', 'username', 'name', 'role', 'email', 'is_active', 'created_at')
        .orderBy('name', 'asc');

      res.json(staff);
    } catch (columnErr: any) {
      // If email column doesn't exist, query without it
      if (columnErr.message?.includes('email') && columnErr.message?.includes('does not exist')) {
        console.warn('Email column not found in staff table, querying without email');
        const staff = await db('staff')
          .where({ is_active: true })
          .select('id', 'employee_id', 'username', 'name', 'role', 'is_active', 'created_at')
          .orderBy('name', 'asc');

        res.json(staff);
      } else {
        throw columnErr;
      }
    }
  } catch (err) {
    console.error('Error fetching staff:', err);
    res.status(500).json({
      message: 'Error fetching staff',
      error: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined
    });
  }
};

// Get staff member by ID
export const getStaffById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    try {
      const staff = await db('staff')
        .where({ id })
        .select('id', 'employee_id', 'username', 'name', 'role', 'email', 'is_active', 'created_at')
        .first();

      if (!staff) {
        return res.status(404).json({ message: 'Staff member not found' });
      }

      res.json(staff);
    } catch (columnErr: any) {
      // If email column doesn't exist, query without it
      if (columnErr.message?.includes('email') && columnErr.message?.includes('does not exist')) {
        console.warn('Email column not found in staff table, querying without email');
        const staff = await db('staff')
          .where({ id })
          .select('id', 'employee_id', 'username', 'name', 'role', 'is_active', 'created_at')
          .first();

        if (!staff) {
          return res.status(404).json({ message: 'Staff member not found' });
        }

        res.json(staff);
      } else {
        throw columnErr;
      }
    }
  } catch (err) {
    console.error('Error fetching staff member:', err);
    res.status(500).json({ 
      message: 'Error fetching staff member',
      error: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined
    });
  }
};

// Create new staff member
export const createStaff = async (req: Request, res: Response) => {
  try {
    console.log('📥 Received request body:', req.body);

    const {
      employee_id,
      username,
      name,
      role,
      email,
      password,
      pin,
      is_active
    } = req.body;

    // Validation
    if (!username || !name || !role || !email) {
      console.log('❌ Validation failed: missing required fields');
      return res.status(400).json({ 
        message: 'Username, name, role, and email are required' 
      });
    }

    // Check if username already exists
    console.log('🔍 Checking if username exists:', username);
    const existingUser = await db('staff').where({ username }).first();
    if (existingUser) {
      console.log('❌ Username already exists');
      return res.status(400).json({ 
        message: 'Username already exists' 
      });
    }

    // Check if employee_id already exists (if provided)
    if (employee_id) {
      console.log('🔍 Checking if employee_id exists:', employee_id);
      const existingEmployeeId = await db('staff').where({ employee_id }).first();
      if (existingEmployeeId) {
        console.log('❌ Employee ID already exists');
        return res.status(400).json({ 
          message: 'Employee ID already exists' 
        });
      }
    }

    // Hash password if provided
    let hashedPassword = null;
    if (password) {
      console.log('🔐 Hashing password...');
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const insertData: any = {
      employee_id: employee_id || null,
      username,
      name,
      role,
      password: hashedPassword,
      pin: pin || null,
      is_active: is_active !== undefined ? is_active : true,
      created_at: new Date(),
      updated_at: new Date()
    };

    // Only include email if the column exists (will be added by migration)
    if (email) {
      insertData.email = email;
    }

    console.log('💾 Inserting staff member:', { ...insertData, password: '***', pin: '***' });

    try {
      const [newStaff] = await db('staff')
        .insert(insertData)
        .returning(['id', 'employee_id', 'username', 'name', 'role', 'email', 'is_active', 'created_at']);

      console.log('✅ Staff member created successfully:', newStaff);
      res.status(201).json(newStaff);
    } catch (insertErr: any) {
      // If email column doesn't exist, insert without it
      if (insertErr.message?.includes('email') && insertErr.message?.includes('does not exist')) {
        console.warn('Email column not found in staff table, inserting without email');
        delete insertData.email;

        const [newStaff] = await db('staff')
          .insert(insertData)
          .returning(['id', 'employee_id', 'username', 'name', 'role', 'is_active', 'created_at']);

        console.log('✅ Staff member created successfully (without email):', newStaff);
        res.status(201).json(newStaff);
      } else {
        throw insertErr;
      }
    }

  } catch (err) {
    console.error('❌ Error adding staff member:', err);
    const errorMsg = (err as any).message || (err as Error).message;
    console.error('Error details:', {
      message: errorMsg,
      name: (err as Error).name
    });
    
    // Provide detailed error messages for specific cases
    if (errorMsg?.includes('duplicate key')) {
      return res.status(400).json({ 
        message: 'A staff member with this username, employee ID, or email already exists',
        error: process.env.NODE_ENV === 'development' ? errorMsg : undefined
      });
    }
    
    res.status(500).json({ 
      message: 'Error adding staff member', 
      error: process.env.NODE_ENV === 'development' ? errorMsg : undefined
    });
  }
};

// Update staff member
export const updateStaff = async (req: Request, res: Response) => {
  try {
    console.log('📝 Updating staff member:', req.params.id);
    console.log('📥 Update data:', req.body);

    const { id } = req.params;
    const updateData: any = { ...req.body };

    // Remove id from update data if present
    delete updateData.id;
    delete updateData.created_at;
    
    // Hash new password if provided
    if (req.body.password) {
      console.log('🔐 Hashing new password...');
      updateData.password = await bcrypt.hash(req.body.password, 10);
    } else {
      // Don't update password if not provided
      delete updateData.password;
    }

    updateData.updated_at = new Date();

    // Check if staff member exists
    const existingStaff = await db('staff').where({ id }).first();
    if (!existingStaff) {
      console.log('❌ Staff member not found');
      return res.status(404).json({ message: 'Staff member not found' });
    }

    // Check for username uniqueness if being updated
    if (updateData.username && updateData.username !== existingStaff.username) {
      const duplicateUsername = await db('staff')
        .where({ username: updateData.username })
        .whereNot({ id })
        .first();

      if (duplicateUsername) {
        console.log('❌ Username already exists');
        return res.status(400).json({ message: 'Username already exists' });
      }
    }

    // Check for employee_id uniqueness if being updated
    if (updateData.employee_id && updateData.employee_id !== existingStaff.employee_id) {
      const duplicateEmployeeId = await db('staff')
        .where({ employee_id: updateData.employee_id })
        .whereNot({ id })
        .first();

      if (duplicateEmployeeId) {
        console.log('❌ Employee ID already exists');
        return res.status(400).json({ message: 'Employee ID already exists' });
      }
    }

    console.log('💾 Updating with data:', { ...updateData, password: updateData.password ? '***' : undefined });

    try {
      const [updatedStaff] = await db('staff')
        .where({ id })
        .update(updateData)
        .returning(['id', 'employee_id', 'username', 'name', 'role', 'email', 'is_active', 'updated_at']);

      console.log('✅ Staff member updated successfully');
      res.json(updatedStaff);
    } catch (updateErr: any) {
      // If email column doesn't exist in returning clause, remove it
      if (updateErr.message?.includes('email') && updateErr.message?.includes('does not exist')) {
        console.warn('Email column not found in staff table, updating without email');
        const [updatedStaff] = await db('staff')
          .where({ id })
          .update(updateData)
          .returning(['id', 'employee_id', 'username', 'name', 'role', 'is_active', 'updated_at']);

        console.log('✅ Staff member updated successfully (without email)');
        res.json(updatedStaff);
      } else {
        throw updateErr;
      }
    }

  } catch (err) {
    console.error('❌ Error updating staff member:', err);
    const errorMsg = (err as any).message || (err as Error).message;
    console.error('Error details:', {
      message: errorMsg,
      name: (err as Error).name
    });
    
    // Provide detailed error messages for specific cases
    if (errorMsg?.includes('duplicate key')) {
      return res.status(400).json({ 
        message: 'A staff member with this username, employee ID, or email already exists',
        error: process.env.NODE_ENV === 'development' ? errorMsg : undefined
      });
    }
    
    res.status(500).json({ 
      message: 'Error updating staff member',
      error: process.env.NODE_ENV === 'development' ? errorMsg : undefined
    });
  }
};

// Delete staff member (soft delete by deactivating)
export const deleteStaff = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if staff member exists
    const existingStaff = await db('staff').where({ id }).first();
    if (!existingStaff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    // Soft delete by setting is_active to false
    await db('staff')
      .where({ id })
      .update({ 
        is_active: false,
        updated_at: new Date() 
      });

    console.log('✅ Staff member deactivated:', id);
    res.status(204).send();

  } catch (err) {
    console.error('Error deleting staff member:', err);
    const errorMsg = (err as any).message || (err as Error).message;
    res.status(500).json({ 
      message: 'Error deleting staff member',
      error: process.env.NODE_ENV === 'development' ? errorMsg : undefined
    });
  }
};

// Get waiters (public endpoint for order creation)
export const getWaiters = async (req: Request, res: Response) => {
  try {
    const waiters = await db('staff')
      .where({ role: 'waiter', is_active: true })
      .select('id', 'employee_id', 'username', 'name')
      .orderBy('name', 'asc');
    
    res.json(waiters);
  } catch (err) {
    console.error('Error fetching waiters:', err);
    const errorMsg = (err as any).message || (err as Error).message;
    res.status(500).json({ 
      message: 'Error fetching waiters',
      error: process.env.NODE_ENV === 'development' ? errorMsg : undefined
    });
  }
};

// Check if staff member is cleared for today (after 8 AM)
export const checkClearance = async (req: Request, res: Response) => {
  try {
    const { id: staffId } = req.params;
    
    // Shift Anchor: 8:00 AM Kenyan Time is 05:00 UTC
    const anchorUTC = new Date();
    anchorUTC.setUTCHours(5, 0, 0, 0);
    if (new Date() < anchorUTC) {
      anchorUTC.setUTCDate(anchorUTC.getUTCDate() - 1);
    }

    // Check if staff member requires clearing
    const staff = await db('staff').where({ id: staffId }).first();
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    // If staff doesn't require clearing (like admin), they are always "cleared"
    if (staff.requires_clearing === false || ['admin', 'manager'].includes(staff.role)) {
      return res.json({
        clearedToday: true,
        message: 'Clearing not required for this role'
      });
    }

    // Strict check: Is there a clearance record for the current shift period?
    const clearance = await db('waiter_clearances')
      .where('staff_id', staffId)
      .where('cleared_at', '>=', anchorUTC)
      .first();

    // Check for uncleared data from BEFORE the anchor
    const unclearedOrder = await db('orders')
      .where('staff_id', staffId)
      .andWhere('is_cleared', false)
      .andWhere('created_at', '<', anchorUTC)
      .first();

    const unclearedExpense = await db('expenses')
      .where('created_by', staffId)
      .andWhere('is_cleared', false)
      .andWhere('created_at', '<', anchorUTC)
      .first();

    const unclearedRoomTx = await db('room_transactions')
      .where('staff_id', staffId)
      .andWhere('is_cleared', false)
      .andWhere('created_at', '<', anchorUTC)
      .first();

    if (!clearance) {
      return res.status(200).json({ 
        clearedToday: true, 
        message: "Clearance required after 8 AM",
        hasUnclearedOrders: !!unclearedOrder,
        hasUnclearedExpenses: !!unclearedExpense,
        hasUnclearedRooms: !!unclearedRoomTx
      });
    }
    
    res.json({
      clearedToday: !unclearedOrder && !unclearedExpense && !unclearedRoomTx,
      hasUnclearedOrders: !!unclearedOrder,
      hasUnclearedExpenses: !!unclearedExpense,
      hasUnclearedRooms: !!unclearedRoomTx
    });
  } catch (err) {
    console.error('Error checking clearance status:', err);
    res.status(500).json({ message: 'Error checking clearance status' });
  }
};