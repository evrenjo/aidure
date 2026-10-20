package com.example.app.service.order;

import jakarta.persistence.EntityManager;

/** Fixture service with native SQL built by concatenation. */
public class OrderSequenceService {

  private final EntityManager entityManager;

  public OrderSequenceService(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  public Object nextNumber(String owner, String table) {
    // nextval: not an entity
    return entityManager
        .createNativeQuery(
            "SELECT max(\"line_no\") FROM \"order_line\" " + "WHERE \"purchase_order_id\" = :id AND item_code = :code")
        .getSingleResult();
  }

  public int copyLines() {
    // INSERT ... SELECT: no JPA/QueryDSL equivalent
    return entityManager
        .createNativeQuery(
            """
            INSERT INTO order_line (id, purchase_order_id, item_code)
            SELECT gen_random_uuid(), :target, item_code FROM order_line WHERE purchase_order_id = :source
            """)
        .executeUpdate();
  }
}
