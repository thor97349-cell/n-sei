"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  checkPassword,
  getExpectedSessionToken,
} from "@/lib/auth";
import { sendNewLeadAlert } from "@/lib/email";
import {
  createBusiness,
  createProfessional,
  updateBusinessPaymentStatus,
  updateBusinessStatus,
  updateProfessionalPaymentStatus,
  updateProfessionalStatus,
} from "@/lib/repo";
import {
  LEAD_STATUSES,
  PAYMENT_STATUSES,
  type LeadStatus,
  type PaymentStatus,
} from "@/lib/types";

function str(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

export async function submitProfessional(formData: FormData) {
  const name = str(formData, "name");
  const email = str(formData, "email");
  const phone = str(formData, "phone");
  const city = str(formData, "city");
  const expertise_area = str(formData, "expertise_area");
  const years_experience = Number(str(formData, "years_experience"));
  const hourly_rate = Number(str(formData, "hourly_rate"));
  const availability = str(formData, "availability");
  const bio = str(formData, "bio");
  const linkedinInput = str(formData, "linkedin_url");
  const linkedin_url = linkedinInput
    ? /^https?:\/\//i.test(linkedinInput)
      ? linkedinInput
      : `https://${linkedinInput}`
    : "";

  if (
    !name ||
    !email ||
    !phone ||
    !city ||
    !expertise_area ||
    !availability ||
    !Number.isFinite(years_experience) ||
    !Number.isFinite(hourly_rate)
  ) {
    throw new Error("Preencha todos os campos obrigatórios corretamente.");
  }

  await createProfessional({
    name,
    email,
    phone,
    city,
    expertise_area,
    years_experience,
    hourly_rate,
    availability,
    bio: bio || undefined,
    linkedin_url: linkedin_url || undefined,
  });

  await sendNewLeadAlert(
    `Novo profissional cadastrado: ${name}`,
    `${name} acabou de se cadastrar como profissional.\n\n` +
      `Área: ${expertise_area}\n` +
      `Experiência: ${years_experience} anos\n` +
      `Valor da hora: R$ ${hourly_rate.toFixed(2)}\n` +
      `Cidade: ${city}\n` +
      `WhatsApp: ${phone}\n` +
      `E-mail: ${email}`,
  );

  redirect("/obrigado?tipo=profissional");
}

export async function submitBusiness(formData: FormData) {
  const business_name = str(formData, "business_name");
  const contact_name = str(formData, "contact_name");
  const email = str(formData, "email");
  const phone = str(formData, "phone");
  const city = str(formData, "city");
  const business_type = str(formData, "business_type");
  const num_employees = Number(str(formData, "num_employees"));
  const help_needed = str(formData, "help_needed");
  const description = str(formData, "description");
  const urgency = str(formData, "urgency");
  const budget = str(formData, "budget");
  const willingnessInput = str(formData, "willingness_to_pay");
  const willingness_to_pay = willingnessInput ? Number(willingnessInput) : NaN;

  if (
    !business_name ||
    !contact_name ||
    !email ||
    !phone ||
    !city ||
    !business_type ||
    !help_needed ||
    !description ||
    !urgency ||
    !Number.isFinite(num_employees)
  ) {
    throw new Error("Preencha todos os campos obrigatórios corretamente.");
  }

  await createBusiness({
    business_name,
    contact_name,
    email,
    phone,
    city,
    business_type,
    num_employees,
    help_needed,
    description,
    urgency,
    budget: budget || undefined,
    willingness_to_pay: Number.isFinite(willingness_to_pay)
      ? willingness_to_pay
      : undefined,
  });

  await sendNewLeadAlert(
    `Novo negócio cadastrado: ${business_name}`,
    `${business_name} acabou de se cadastrar precisando de ajuda.\n\n` +
      `Tipo de negócio: ${business_type}\n` +
      `Precisa de: ${help_needed}\n` +
      `Urgência: ${urgency}\n` +
      `Cidade: ${city}\n` +
      `Contato: ${contact_name}\n` +
      `WhatsApp: ${phone}\n` +
      `E-mail: ${email}`,
  );

  redirect("/obrigado?tipo=negocio");
}

export async function adminLogin(formData: FormData) {
  const password = str(formData, "password");

  if (!checkPassword(password)) {
    redirect("/admin/login?erro=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, await getExpectedSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  redirect("/admin");
}

export async function adminLogout() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}

export async function updateLeadStatus(formData: FormData) {
  const type = str(formData, "type");
  const id = Number(str(formData, "id"));
  const status = str(formData, "status") as LeadStatus;

  if (!Number.isFinite(id) || !LEAD_STATUSES.includes(status)) {
    throw new Error("Dados inválidos.");
  }

  if (type === "professional") {
    await updateProfessionalStatus(id, status);
    redirect("/admin/profissionais");
  } else if (type === "business") {
    await updateBusinessStatus(id, status);
    redirect("/admin/negocios");
  } else {
    throw new Error("Tipo inválido.");
  }
}

export async function updatePaymentStatus(formData: FormData) {
  const type = str(formData, "type");
  const id = Number(str(formData, "id"));
  const paymentStatus = str(formData, "payment_status") as PaymentStatus;

  if (!Number.isFinite(id) || !PAYMENT_STATUSES.includes(paymentStatus)) {
    throw new Error("Dados inválidos.");
  }

  if (type === "professional") {
    await updateProfessionalPaymentStatus(id, paymentStatus);
    redirect("/admin/profissionais");
  } else if (type === "business") {
    await updateBusinessPaymentStatus(id, paymentStatus);
    redirect("/admin/negocios");
  } else {
    throw new Error("Tipo inválido.");
  }
}
