export type Account = {
  account_id: string;
  name: string;
  tax_id: string | null;
  economic_sector: string | null;
  address: string | null;
  website: string | null;
  is_high_value: boolean;
  created_at: string;
  updated_at: string;
};

export type Person = {
  person_id: string;
  name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  account_id: string;
  account_name?: string | null;
  has_active_influence?: boolean;
  created_at: string;
  updated_at: string;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type AccountsQuery = {
  q?: string;
  page?: number;
  limit?: number;
};

export type PeopleQuery = {
  q?: string;
  account_id?: string;
  page?: number;
  limit?: number;
};

export type CreateAccountPayload = {
  name: string;
  tax_id?: string | null;
  economic_sector?: string | null;
  address?: string | null;
  website?: string | null;
  is_high_value?: boolean;
};

export type UpdateAccountPayload = {
  name?: string;
  tax_id?: string | null;
  economic_sector?: string | null;
  address?: string | null;
  website?: string | null;
  is_high_value?: boolean;
};

export type CreatePersonPayload = {
  name: string;
  job_title?: string | null;
  email?: string | null;
  phone?: string | null;
  account_id: string;
};

export type UpdatePersonPayload = {
  name?: string;
  job_title?: string | null;
  email?: string | null;
  phone?: string | null;
};
