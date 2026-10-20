package com.example.app.model.base;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import java.time.LocalDateTime;

/** Common audit columns. */
@MappedSuperclass
public abstract class BaseEntity {

  @Column(name = "created_at", nullable = false, updatable = false)
  private LocalDateTime createdAt;

  private LocalDateTime updatedAt;
}
