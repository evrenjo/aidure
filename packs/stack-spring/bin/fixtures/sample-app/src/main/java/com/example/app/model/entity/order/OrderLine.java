package com.example.app.model.entity.order;

import jakarta.persistence.Entity;
import jakarta.persistence.Transient;
import java.util.UUID;

/** Order line, no @Table: default naming applies. */
@Entity
public class OrderLine {

  private UUID id;

  private UUID purchaseOrderId;

  private String itemCode;

  @Transient
  private String displayOnly;
}
