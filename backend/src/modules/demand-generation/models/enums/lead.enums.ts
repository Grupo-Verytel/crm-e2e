export enum TipoLead {
  Inbound = 'Inbound',
  Outbound = 'Outbound',
  Referido = 'Referido',
  Aliado = 'Aliado',
  Licitacion = 'Licitacion',
}

export enum OrigenLead {
  Web = 'Web',
  EmailMarketing = 'Email marketing',
  InstagramYFacebook = 'Instagram y Facebook',
  ProspeccionDirecta = 'Prospeccion directa',
  LinkedIn = 'LinkedIn',
  Evento = 'Evento',
  SECOP = 'SECOP',
  Aliado = 'Aliado',
  Otro = 'Otro',
  Referido = 'Referido',
}

export enum CanalOrigen {
  CampanaDigital = 'CAMPANA_DIGITAL',
  BTL = 'BTL',
  Fabrica = 'FABRICA',
  GeneracionDemandaAgencia = 'GENERACION_DEMANDA_AGENCIA',
  TraductorNegocio = 'TRADUCTOR_NEGOCIO',
  Eventos = 'EVENTOS',
  Referido = 'REFERIDO',
}

export enum TipoInfluencia {
  Coach = 'Coach',
  Tecnica = 'Tecnica',
  Economica = 'Economica',
  Usuaria = 'Usuaria',
  DeFabrica = 'DeFabrica',
}

/** Optional influence type assigned to a lead contact. */
export enum LeadContactInfluenciaTipo {
  Economica = 'Economica',
  Tecnica = 'Tecnica',
  Fabrica = 'Fabrica',
  Coach = 'Coach',
  Usuario = 'Usuario',
}

export enum LeadEstado {
  Nuevo = 'Nuevo',
  TOFU = 'TOFU',
  MOFU = 'MOFU',
  MqlPending = 'MQL_PENDING',
  SQL = 'SQL',
  Reciclaje = 'Reciclaje',
  Descartado = 'Descartado',
}
