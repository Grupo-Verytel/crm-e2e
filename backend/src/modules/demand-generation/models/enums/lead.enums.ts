export enum TipoLead {
  Inbound = 'Inbound',
  Outbound = 'Outbound',
  Referido = 'Referido',
  Aliado = 'Aliado',
  Licitacion = 'Licitacion',
}

export enum OrigenLead {
  Web = 'Web',
  Email = 'Email',
  LinkedIn = 'LinkedIn',
  Evento = 'Evento',
  SECOP = 'SECOP',
  Aliado = 'Aliado',
  Otro = 'Otro',
  Referido = 'Referido',
}

export enum TipoInfluencia {
  Coach = 'Coach',
  Tecnica = 'Tecnica',
  Economica = 'Economica',
  Usuaria = 'Usuaria',
  DeFabrica = 'DeFabrica',
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
