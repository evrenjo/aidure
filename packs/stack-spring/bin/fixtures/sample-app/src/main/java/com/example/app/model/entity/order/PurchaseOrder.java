package com.example.app.model.entity.order;

import com.example.app.model.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

/** Order header. */
@Entity
@Table(name = "purchase_order")
public class PurchaseOrder extends BaseEntity {

  @Column(name = "id")
  private UUID id;

  @Column(name = "owner_code")
  private String ownerCode;

  @Column(
      name = "order_status_code",
      length = 10)
  private String statusCode;

  private Boolean isDeleted;

  private static final String IGNORED = "x";
}
