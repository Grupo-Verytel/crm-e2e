'use strict';

/** Exact `roles.name`. Comparisons import this module; they do not repeat the text. */
const GERENTE_COMERCIAL_ROLE_NAME = 'Gerente Comercial';

const EJECUTIVO_COMERCIAL_ROLE_NAME = 'EjecutivoComercial';

/** Users who may be stored as the assigned commercial on an OUV or a SQL. */
const ASSIGNABLE_COMMERCIAL_ROLE_NAMES = [
  EJECUTIVO_COMERCIAL_ROLE_NAME,
  GERENTE_COMERCIAL_ROLE_NAME,
];

module.exports = {
  GERENTE_COMERCIAL_ROLE_NAME,
  EJECUTIVO_COMERCIAL_ROLE_NAME,
  ASSIGNABLE_COMMERCIAL_ROLE_NAMES,
};
