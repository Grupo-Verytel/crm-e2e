import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';
import type {
  Account,
  AccountsQuery,
  CreateAccountPayload,
  CreatePersonPayload,
  Paginated,
  PeopleQuery,
  Person,
  UpdateAccountPayload,
  UpdatePersonPayload,
} from '../types';

export async function fetchAccounts(
  query: AccountsQuery = {},
): Promise<Paginated<Account>> {
  return apiRequest<Paginated<Account>>(
    `/accounts${buildQueryString(query)}`,
  );
}

export async function fetchAccount(accountId: string): Promise<Account> {
  return apiRequest<Account>(`/accounts/${accountId}`);
}

export async function createAccount(
  payload: CreateAccountPayload,
): Promise<Account> {
  return apiRequest<Account>('/accounts', { method: 'POST', body: payload });
}

export async function updateAccount(
  accountId: string,
  payload: UpdateAccountPayload,
): Promise<Account> {
  return apiRequest<Account>(`/accounts/${accountId}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteAccount(accountId: string): Promise<void> {
  await apiRequest<void>(`/accounts/${accountId}`, { method: 'DELETE' });
}

export async function fetchPeople(
  query: PeopleQuery = {},
): Promise<Paginated<Person>> {
  return apiRequest<Paginated<Person>>(
    `/accounts/people${buildQueryString(query)}`,
  );
}

export async function createPerson(
  payload: CreatePersonPayload,
): Promise<Person> {
  return apiRequest<Person>('/accounts/people', {
    method: 'POST',
    body: payload,
  });
}

export async function updatePerson(
  personId: string,
  payload: UpdatePersonPayload,
): Promise<Person> {
  return apiRequest<Person>(`/accounts/people/${personId}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deletePerson(personId: string): Promise<void> {
  await apiRequest<void>(`/accounts/people/${personId}`, { method: 'DELETE' });
}
