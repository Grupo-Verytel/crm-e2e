'use strict';

/**
 * SPEC-CRM-MEPLEAN-001 §8 / §9.1 / §10.1 / §12.1 — T-003.
 *
 * DDL literal del spec. Dos precisiones respecto al texto:
 *
 *  1. `audit_log` se materializa como `mep_audit_log`: el nombre `audit_log` ya
 *     existe en el CRM con un esquema incompatible (`tabla`, `registro_id`,
 *     `accion`). Artículo II de CONSTITUTION.md — la realidad del repo manda.
 *     Todas las columnas del §12.1 se conservan íntegras.
 *  2. `api_key` se materializa como `mep_api_key` para no colisionar con el
 *     módulo Auth/RBAC del CRM (OPEN-05).
 *
 * El carácter append-only de `mep_response_version`, `processing_receipt` y
 * `mep_audit_log` se aplica en BD con triggers `BEFORE UPDATE`/`BEFORE DELETE`
 * (no solo por código). El GRANT restrictivo equivalente para el usuario de la
 * aplicación está documentado en `src/modules/mep-integration/README.md`.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const sql = queryInterface.sequelize;

    await sql.query(`
      CREATE TABLE commercial_interaction (
        id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        crm_interaction_ref VARCHAR(64)  NOT NULL UNIQUE,
        crm_opportunity_ref VARCHAR(64)  NULL,
        service_horizon     ENUM('IMMEDIATE','DEFERRED','UNSPECIFIED') NOT NULL,
        subject             VARCHAR(512) NULL,
        source_content      MEDIUMTEXT   NOT NULL,
        source_created_at   DATETIME(3)  NOT NULL,
        source_version      VARCHAR(32)  NOT NULL,
        etag                VARCHAR(96)  NOT NULL,
        eligible_for_mep    TINYINT(1)   NOT NULL DEFAULT 1,
        created_at          DATETIME(3)  NOT NULL,
        updated_at          DATETIME(3)  NOT NULL,
        KEY ix_intake_order (source_created_at, id),
        KEY ix_horizon (service_horizon, source_created_at, id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await sql.query(`
      CREATE TABLE interaction_requested_service (
        id             BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        interaction_id BIGINT UNSIGNED NOT NULL,
        service        ENUM('TECHNICAL_DESIGN','FINANCIAL_DESIGN') NOT NULL,
        dependency     ENUM('NONE','TECHNICAL_DESIGN','FINANCIAL_DESIGN') NOT NULL,
        position       TINYINT UNSIGNED NOT NULL,
        UNIQUE KEY uq_service (interaction_id, service),
        CONSTRAINT fk_irs_interaction FOREIGN KEY (interaction_id)
          REFERENCES commercial_interaction(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await sql.query(`
      CREATE TABLE commercial_opportunity (
        id                    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        crm_opportunity_ref   VARCHAR(64) NOT NULL UNIQUE,
        title                 VARCHAR(512) NULL,
        organization_ref      VARCHAR(64)  NULL,
        organization_name     VARCHAR(512) NULL,
        commercial_amount     BIGINT       NULL,
        commercial_currency   CHAR(3)      NULL,
        stage_ref             VARCHAR(64)  NULL,
        stage_name            VARCHAR(256) NULL,
        status                ENUM('OPEN','WON','LOST','CANCELLED') NULL,
        expected_close_date   DATE         NULL,
        commercial_owner_ref  VARCHAR(64)  NULL,
        commercial_owner_name VARCHAR(256) NULL,
        archetype_ref         VARCHAR(64)  NULL,
        archetype_name        VARCHAR(256) NULL,
        source_version        VARCHAR(32)  NOT NULL,
        etag                  VARCHAR(96)  NOT NULL,
        updated_at            DATETIME(3)  NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await sql.query(`
      CREATE TABLE processing_receipt (
        id                   BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        interaction_id       BIGINT UNSIGNED NOT NULL,
        receipt_id           VARCHAR(128) NOT NULL,
        receipt_version      INT UNSIGNED NOT NULL,
        processing_status    ENUM('ACCEPTED','DUPLICATE','QUARANTINED','REJECTED') NOT NULL,
        correlation_id       VARCHAR(128) NOT NULL,
        observed_at          DATETIME(3)  NOT NULL,
        adapter_version      VARCHAR(32)  NOT NULL,
        reason_code          VARCHAR(64)  NULL,
        semantic_fingerprint CHAR(64)     NOT NULL,
        payload_hash         CHAR(64)     NOT NULL,
        etag                 VARCHAR(96)  NOT NULL,
        created_at           DATETIME(3)  NOT NULL,
        UNIQUE KEY uq_receipt_version (receipt_id, receipt_version),
        KEY ix_receipt_interaction (interaction_id, created_at),
        CONSTRAINT fk_receipt_interaction FOREIGN KEY (interaction_id)
          REFERENCES commercial_interaction(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await sql.query(`
      CREATE TABLE mep_response (
        id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        interaction_id  BIGINT UNSIGNED NOT NULL,
        response_id     VARCHAR(128) NOT NULL,
        current_version INT UNSIGNED NOT NULL,
        etag            VARCHAR(96)  NOT NULL,
        created_at      DATETIME(3)  NOT NULL,
        updated_at      DATETIME(3)  NOT NULL,
        UNIQUE KEY uq_response (interaction_id, response_id),
        UNIQUE KEY uq_response_id (response_id),
        CONSTRAINT fk_response_interaction FOREIGN KEY (interaction_id)
          REFERENCES commercial_interaction(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await sql.query(`
      CREATE TABLE mep_response_version (
        id                          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        mep_response_id             BIGINT UNSIGNED NOT NULL,
        response_version            INT UNSIGNED NOT NULL,
        business_milestone          ENUM('INTERACTION_RECEIVED','ENGINEER_ASSIGNED',
                                         'ROUTE_CAPACITY_REGISTERED','INTERACTION_COMPLETED') NOT NULL,
        response_status             ENUM('RECEIVED','IN_PROGRESS','COMPLETED') NOT NULL,
        eta_date                    DATE NULL,
        next_milestone              VARCHAR(512) NULL,
        responded_at                DATETIME(3) NOT NULL,
        responded_by_ref            VARCHAR(64)  NOT NULL,
        responded_by_name           VARCHAR(256) NOT NULL,
        assignment_engineer_ref     VARCHAR(64)  NULL,
        assignment_engineer_name    VARCHAR(256) NULL,
        assignment_assigned_at      DATETIME(3)  NULL,
        rc_version                  VARCHAR(8)   NULL,
        rc_route_status             ENUM('VIABLE','NOT_VIABLE','CONDITIONED') NULL,
        rc_capacity_status          ENUM('PLANNED','NOT_PLANNED','CONDITIONED') NULL,
        rc_summary                  TEXT NULL,
        rc_registered_at            DATETIME(3) NULL,
        rc_registered_by_ref        VARCHAR(64) NULL,
        rc_registered_by_name       VARCHAR(256) NULL,
        planner_interaction_url     VARCHAR(1024) NULL,
        route_capacity_register_url VARCHAR(1024) NULL,
        narrative_note              TEXT NULL,
        delivered_interaction_type  VARCHAR(128) NULL,
        semantic_fingerprint        CHAR(64) NOT NULL,
        payload_hash                CHAR(64) NOT NULL,
        etag                        VARCHAR(96) NOT NULL,
        created_at                  DATETIME(3) NOT NULL,
        UNIQUE KEY uq_version (mep_response_id, response_version),
        CONSTRAINT fk_version_response FOREIGN KEY (mep_response_id)
          REFERENCES mep_response(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await sql.query(`
      CREATE TABLE mep_service_result (
        id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        response_version_id BIGINT UNSIGNED NOT NULL,
        service             ENUM('TECHNICAL_DESIGN','FINANCIAL_DESIGN') NOT NULL,
        status              ENUM('RECEIVED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL,
        outcome             ENUM('VIABLE','NOT_VIABLE','PARTIAL') NULL,
        dependency          ENUM('NONE','TECHNICAL_DESIGN','FINANCIAL_DESIGN') NOT NULL,
        summary             TEXT NULL,
        reason_code         VARCHAR(64) NULL,
        position            TINYINT UNSIGNED NOT NULL,
        UNIQUE KEY uq_srv (response_version_id, service),
        CONSTRAINT fk_srv_version FOREIGN KEY (response_version_id)
          REFERENCES mep_response_version(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await sql.query(`
      CREATE TABLE mep_deliverable (
        id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        service_result_id BIGINT UNSIGNED NOT NULL,
        url               VARCHAR(1024) NOT NULL,
        label             VARCHAR(256) NULL,
        published_at      DATETIME(3) NULL,
        CONSTRAINT fk_deliverable_srv FOREIGN KEY (service_result_id)
          REFERENCES mep_service_result(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await sql.query(`
      CREATE TABLE idempotency_record (
        id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        api_key_id      BIGINT UNSIGNED NOT NULL,
        method          VARCHAR(8)   NOT NULL,
        path            VARCHAR(512) NOT NULL,
        idempotency_key VARCHAR(256) NOT NULL,
        request_hash    CHAR(64)     NOT NULL,
        status          ENUM('IN_FLIGHT','COMPLETED') NOT NULL,
        response_status INT UNSIGNED NULL,
        response_body   MEDIUMTEXT   NULL,
        response_etag   VARCHAR(96)  NULL,
        created_at      DATETIME(3)  NOT NULL,
        expires_at      DATETIME(3)  NOT NULL,
        UNIQUE KEY uq_idem (api_key_id, method, path, idempotency_key),
        KEY ix_idem_expiry (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await sql.query(`
      CREATE TABLE mep_api_key (
        id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        identity     VARCHAR(64)  NOT NULL,
        environment  ENUM('sandbox','staging','production') NOT NULL,
        key_prefix   CHAR(12)     NOT NULL,
        key_hash     VARCHAR(255) NOT NULL,
        scopes       JSON         NOT NULL,
        rate_tier    VARCHAR(32)  NOT NULL DEFAULT 'default',
        created_at   DATETIME(3)  NOT NULL,
        expires_at   DATETIME(3)  NOT NULL,
        revoked_at   DATETIME(3)  NULL,
        last_used_at DATETIME(3)  NULL,
        UNIQUE KEY uq_prefix (key_prefix)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await sql.query(`
      CREATE TABLE mep_audit_log (
        id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        occurred_at       DATETIME(3)  NOT NULL,
        correlation_id    VARCHAR(128) NOT NULL,
        request_id        VARCHAR(64)  NOT NULL,
        actor_type        ENUM('SERVICE','USER','SYSTEM') NOT NULL,
        actor_identity    VARCHAR(64)  NOT NULL,
        api_key_prefix    CHAR(12)     NULL,
        source_ip         VARCHAR(45)  NULL,
        http_method       VARCHAR(8)   NOT NULL,
        http_path         VARCHAR(512) NOT NULL,
        http_status       INT UNSIGNED NOT NULL,
        operation         VARCHAR(64)  NOT NULL,
        resource_type     VARCHAR(64)  NOT NULL,
        resource_ref      VARCHAR(128) NOT NULL,
        interaction_ref   VARCHAR(64)  NULL,
        opportunity_ref   VARCHAR(64)  NULL,
        idempotency_key   VARCHAR(256) NULL,
        idempotent_replay TINYINT(1)   NOT NULL DEFAULT 0,
        if_match          VARCHAR(96)  NULL,
        outcome           ENUM('SUCCESS','REJECTED','ERROR') NOT NULL,
        error_code        VARCHAR(64)  NULL,
        request_hash      CHAR(64)     NULL,
        before_state      JSON         NULL,
        after_state       JSON         NULL,
        latency_ms        INT UNSIGNED NOT NULL,
        adapter_version   VARCHAR(32)  NULL,
        prev_hash         CHAR(64)     NULL,
        entry_hash        CHAR(64)     NOT NULL,
        KEY ix_corr (correlation_id),
        KEY ix_res (resource_type, resource_ref, occurred_at),
        KEY ix_interaction (interaction_ref, occurred_at),
        KEY ix_time (occurred_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // P-07 / INV-07: `source_content` es intocable por cualquier ruta.
    await sql.query(`
      CREATE TRIGGER trg_commercial_interaction_source_content_immutable
      BEFORE UPDATE ON commercial_interaction
      FOR EACH ROW
      BEGIN
        IF NOT (NEW.source_content <=> OLD.source_content) THEN
          SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'source_content is immutable (P-07 / INV-07)';
        END IF;
      END
    `);

    // Append-only en BD (§8, INV-33): sin UPDATE ni DELETE.
    const appendOnly = [
      'processing_receipt',
      'mep_response_version',
      'mep_audit_log',
    ];

    for (const table of appendOnly) {
      await sql.query(`
        CREATE TRIGGER trg_${table}_no_update
        BEFORE UPDATE ON ${table}
        FOR EACH ROW
        BEGIN
          SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '${table} is append-only';
        END
      `);

      await sql.query(`
        CREATE TRIGGER trg_${table}_no_delete
        BEFORE DELETE ON ${table}
        FOR EACH ROW
        BEGIN
          SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '${table} is append-only';
        END
      `);
    }
  },

  async down(queryInterface) {
    const sql = queryInterface.sequelize;

    for (const table of [
      'processing_receipt',
      'mep_response_version',
      'mep_audit_log',
    ]) {
      await sql.query(`DROP TRIGGER IF EXISTS trg_${table}_no_update`);
      await sql.query(`DROP TRIGGER IF EXISTS trg_${table}_no_delete`);
    }

    await sql.query(
      'DROP TRIGGER IF EXISTS trg_commercial_interaction_source_content_immutable',
    );

    // Orden inverso por dependencias de FK.
    for (const table of [
      'mep_audit_log',
      'mep_api_key',
      'idempotency_record',
      'mep_deliverable',
      'mep_service_result',
      'mep_response_version',
      'mep_response',
      'processing_receipt',
      'commercial_opportunity',
      'interaction_requested_service',
      'commercial_interaction',
    ]) {
      await sql.query(`DROP TABLE IF EXISTS ${table}`);
    }
  },
};
