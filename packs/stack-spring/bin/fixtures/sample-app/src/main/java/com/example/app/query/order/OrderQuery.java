package com.example.app.query.order;

import static com.example.app.model.entity.order.QPurchaseOrder.purchaseOrder;

import com.example.app.model.entity.order.QOrderLine;
import com.example.app.model.entity.order.QPurchaseOrder;
import com.querydsl.core.BooleanBuilder;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.List;
import java.util.UUID;

/** Fixture query: two methods with the same local alias bound to different Q types. */
public class OrderQuery {

  private final JPAQueryFactory queryFactory;

  public OrderQuery(JPAQueryFactory queryFactory) {
    this.queryFactory = queryFactory;
  }

  public List<UUID> findOpenOrders(String owner) {
    return queryFactory
        .select(purchaseOrder.id)
        .from(purchaseOrder)
        .where(buildWhere(owner))
        .fetch();
  }

  public List<UUID> findLinesByItem(String itemCode) {
    QOrderLine o = QOrderLine.orderLine;
    return queryFactory.select(o.id).from(o).where(o.itemCode.eq(itemCode)).fetch();
  }

  public List<UUID> findOrdersWithAlias(String owner) {
    QPurchaseOrder o = QPurchaseOrder.purchaseOrder;
    QOrderLine l = QOrderLine.orderLine;
    return queryFactory
        .select(o.id)
        .from(o)
        .join(l)
        .on(l.purchaseOrderId.eq(o.id))
        .where(o.ownerCode.eq(owner), o.createdAt.goe(java.time.LocalDateTime.MIN))
        .fetch();
  }

  private BooleanBuilder buildWhere(String owner) {
    BooleanBuilder where = new BooleanBuilder();
    where.and(purchaseOrder.ownerCode.eq(owner));
    where.and(purchaseOrder.statusCode.ne("CLOSED"));
    where.and(purchaseOrder.isDeleted.isFalse());
    return where;
  }
}
