import { getDb } from "./db";
import type { Business, LeadStatus, Professional } from "./types";

export interface NewProfessional {
  name: string;
  email: string;
  phone: string;
  city: string;
  expertise_area: string;
  years_experience: number;
  hourly_rate: number;
  availability: string;
  bio?: string;
}

export interface NewBusiness {
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  city: string;
  business_type: string;
  num_employees: number;
  help_needed: string;
  description: string;
  urgency: string;
  budget?: string;
}

export function createProfessional(data: NewProfessional): number {
  const stmt = getDb().prepare(`
    INSERT INTO professionals
      (name, email, phone, city, expertise_area, years_experience, hourly_rate, availability, bio)
    VALUES
      (@name, @email, @phone, @city, @expertise_area, @years_experience, @hourly_rate, @availability, @bio)
  `);
  const info = stmt.run({ ...data, bio: data.bio ?? null });
  return Number(info.lastInsertRowid);
}

export function createBusiness(data: NewBusiness): number {
  const stmt = getDb().prepare(`
    INSERT INTO businesses
      (business_name, contact_name, email, phone, city, business_type, num_employees, help_needed, description, urgency, budget)
    VALUES
      (@business_name, @contact_name, @email, @phone, @city, @business_type, @num_employees, @help_needed, @description, @urgency, @budget)
  `);
  const info = stmt.run({ ...data, budget: data.budget ?? null });
  return Number(info.lastInsertRowid);
}

export function listProfessionals(): Professional[] {
  return getDb()
    .prepare("SELECT * FROM professionals ORDER BY created_at DESC")
    .all() as Professional[];
}

export function listBusinesses(): Business[] {
  return getDb()
    .prepare("SELECT * FROM businesses ORDER BY created_at DESC")
    .all() as Business[];
}

export function updateProfessionalStatus(id: number, status: LeadStatus) {
  getDb()
    .prepare("UPDATE professionals SET status = ? WHERE id = ?")
    .run(status, id);
}

export function updateBusinessStatus(id: number, status: LeadStatus) {
  getDb()
    .prepare("UPDATE businesses SET status = ? WHERE id = ?")
    .run(status, id);
}

export function counts() {
  const professionals = getDb()
    .prepare("SELECT COUNT(*) as n FROM professionals")
    .get() as { n: number };
  const businesses = getDb()
    .prepare("SELECT COUNT(*) as n FROM businesses")
    .get() as { n: number };
  return { professionals: professionals.n, businesses: businesses.n };
}
