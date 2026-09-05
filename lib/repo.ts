import { getSqlReady } from "./db";
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

// The Neon serverless driver can return numeric/bigint columns as strings,
// so coerce explicitly rather than trusting the row shape.
function toProfessional(row: Record<string, unknown>): Professional {
  return {
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone),
    city: String(row.city),
    expertise_area: String(row.expertise_area),
    years_experience: Number(row.years_experience),
    hourly_rate: Number(row.hourly_rate),
    availability: String(row.availability),
    bio: row.bio == null ? null : String(row.bio),
    status: row.status as LeadStatus,
    created_at: String(row.created_at),
  };
}

function toBusiness(row: Record<string, unknown>): Business {
  return {
    id: Number(row.id),
    business_name: String(row.business_name),
    contact_name: String(row.contact_name),
    email: String(row.email),
    phone: String(row.phone),
    city: String(row.city),
    business_type: String(row.business_type),
    num_employees: Number(row.num_employees),
    help_needed: String(row.help_needed),
    description: String(row.description),
    urgency: String(row.urgency),
    budget: row.budget == null ? null : String(row.budget),
    status: row.status as LeadStatus,
    created_at: String(row.created_at),
  };
}

export async function createProfessional(
  data: NewProfessional,
): Promise<number> {
  const sql = await getSqlReady();
  const rows = await sql`
    INSERT INTO professionals
      (name, email, phone, city, expertise_area, years_experience, hourly_rate, availability, bio)
    VALUES
      (${data.name}, ${data.email}, ${data.phone}, ${data.city}, ${data.expertise_area}, ${data.years_experience}, ${data.hourly_rate}, ${data.availability}, ${data.bio ?? null})
    RETURNING id
  `;
  return Number(rows[0].id);
}

export async function createBusiness(data: NewBusiness): Promise<number> {
  const sql = await getSqlReady();
  const rows = await sql`
    INSERT INTO businesses
      (business_name, contact_name, email, phone, city, business_type, num_employees, help_needed, description, urgency, budget)
    VALUES
      (${data.business_name}, ${data.contact_name}, ${data.email}, ${data.phone}, ${data.city}, ${data.business_type}, ${data.num_employees}, ${data.help_needed}, ${data.description}, ${data.urgency}, ${data.budget ?? null})
    RETURNING id
  `;
  return Number(rows[0].id);
}

export async function listProfessionals(): Promise<Professional[]> {
  const sql = await getSqlReady();
  const rows = await sql`SELECT * FROM professionals ORDER BY created_at DESC`;
  return rows.map(toProfessional);
}

export async function listBusinesses(): Promise<Business[]> {
  const sql = await getSqlReady();
  const rows = await sql`SELECT * FROM businesses ORDER BY created_at DESC`;
  return rows.map(toBusiness);
}

export async function updateProfessionalStatus(
  id: number,
  status: LeadStatus,
): Promise<void> {
  const sql = await getSqlReady();
  await sql`UPDATE professionals SET status = ${status} WHERE id = ${id}`;
}

export async function updateBusinessStatus(
  id: number,
  status: LeadStatus,
): Promise<void> {
  const sql = await getSqlReady();
  await sql`UPDATE businesses SET status = ${status} WHERE id = ${id}`;
}

export async function counts(): Promise<{
  professionals: number;
  businesses: number;
}> {
  const sql = await getSqlReady();
  const professionalRows = await sql`SELECT COUNT(*)::int AS n FROM professionals`;
  const businessRows = await sql`SELECT COUNT(*)::int AS n FROM businesses`;
  return {
    professionals: Number(professionalRows[0].n),
    businesses: Number(businessRows[0].n),
  };
}
