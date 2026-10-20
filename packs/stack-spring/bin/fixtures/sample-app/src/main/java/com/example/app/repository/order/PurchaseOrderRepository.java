package com.example.app.repository.order;

import com.example.app.model.entity.order.PurchaseOrder;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Fixture repository. */
public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, UUID> {

  Optional<PurchaseOrder> findByIdAndIsDeleted(UUID id, Boolean isDeleted);

  List<PurchaseOrder> findAllByOwnerCodeAndStatusCodeInOrderByCreatedAtDesc(String ownerCode, List<String> codes);

  long countByOwnerCodeAndUnknownThing(String ownerCode, String x);
}
