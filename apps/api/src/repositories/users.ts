import { requirePool } from '../db/requirePool';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
}

interface AdminUserRow {
  Id: number;
  Name: string;
  Email: string;
}

export interface AppUser {
  id: number;
  name: string;
  email: string;
  role: 'member' | 'admin';
}

interface AppUserRow {
  Id: number;
  Name: string;
  Email: string;
  Role: 'member' | 'admin';
}

/** Powers the Orders page's return-handover dropdown (member-facing, so any authenticated user can call it). */
export async function listAdmins(): Promise<AdminUser[]> {
  const pool = requirePool();
  const result = await pool
    .request()
    .query("SELECT Id, Name, Email FROM dbo.Users WHERE Role = 'admin' ORDER BY Name ASC");
  return (result.recordset as AdminUserRow[]).map((row) => ({
    id: row.Id,
    name: row.Name,
    email: row.Email,
  }));
}

/** Powers the admin Orders page's customer name/email lookups (admin-only). */
export async function listUsers(): Promise<AppUser[]> {
  const pool = requirePool();
  const result = await pool
    .request()
    .query('SELECT Id, Name, Email, Role FROM dbo.Users ORDER BY Name ASC');
  return (result.recordset as AppUserRow[]).map((row) => ({
    id: row.Id,
    name: row.Name,
    email: row.Email,
    role: row.Role,
  }));
}
