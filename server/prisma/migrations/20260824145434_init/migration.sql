-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'AGENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('B2B', 'B2C');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('PREPAID', 'COD');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_areas" (
    "id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "area_name" TEXT NOT NULL,

    CONSTRAINT "zone_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_cards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order_type" "OrderType" NOT NULL,
    "from_zone_id" TEXT NOT NULL,
    "to_zone_id" TEXT NOT NULL,
    "is_intra_zone" BOOLEAN NOT NULL,
    "base_rate_per_kg" DECIMAL(10,2) NOT NULL,
    "cod_surcharge_percent" DECIMAL(5,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "tracking_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "created_by_admin_id" TEXT,
    "pickup_address" TEXT NOT NULL,
    "drop_address" TEXT NOT NULL,
    "pickup_zone_id" TEXT NOT NULL,
    "drop_zone_id" TEXT NOT NULL,
    "length_cm" DOUBLE PRECISION NOT NULL,
    "breadth_cm" DOUBLE PRECISION NOT NULL,
    "height_cm" DOUBLE PRECISION NOT NULL,
    "actual_weight_kg" DECIMAL(10,3) NOT NULL,
    "volumetric_weight_kg" DECIMAL(10,3) NOT NULL,
    "billable_weight_kg" DECIMAL(10,3) NOT NULL,
    "order_type" "OrderType" NOT NULL,
    "payment_type" "PaymentType" NOT NULL,
    "rate_card_id" TEXT,
    "base_rate_per_kg" DECIMAL(10,2) NOT NULL,
    "charge" DECIMAL(10,2) NOT NULL,
    "cod_surcharge" DECIMAL(10,2) NOT NULL,
    "total_charge" DECIMAL(10,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_agent_id" TEXT,
    "scheduled_delivery_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_tracking_events" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "actor_id" TEXT,
    "actor_role" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_reschedules" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "original_date" DATE NOT NULL,
    "new_date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_reschedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_availability" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "current_zone_id" TEXT NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "zones_name_key" ON "zones"("name");

-- CreateIndex
CREATE INDEX "zone_areas_area_name_idx" ON "zone_areas"("area_name");

-- CreateIndex
CREATE INDEX "rate_cards_from_zone_id_to_zone_id_order_type_idx" ON "rate_cards"("from_zone_id", "to_zone_id", "order_type");

-- CreateIndex
CREATE UNIQUE INDEX "rate_cards_from_zone_id_to_zone_id_order_type_is_intra_zone_key" ON "rate_cards"("from_zone_id", "to_zone_id", "order_type", "is_intra_zone", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tracking_number_key" ON "orders"("tracking_number");

-- CreateIndex
CREATE INDEX "orders_tracking_number_idx" ON "orders"("tracking_number");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_assigned_agent_id_idx" ON "orders"("assigned_agent_id");

-- CreateIndex
CREATE INDEX "orders_pickup_zone_id_idx" ON "orders"("pickup_zone_id");

-- CreateIndex
CREATE INDEX "orders_drop_zone_id_idx" ON "orders"("drop_zone_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "order_tracking_events_order_id_idx" ON "order_tracking_events"("order_id");

-- CreateIndex
CREATE INDEX "order_tracking_events_created_at_idx" ON "order_tracking_events"("created_at");

-- CreateIndex
CREATE INDEX "delivery_reschedules_order_id_idx" ON "delivery_reschedules"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_availability_agent_id_key" ON "agent_availability"("agent_id");

-- CreateIndex
CREATE INDEX "agent_availability_current_zone_id_is_available_idx" ON "agent_availability"("current_zone_id", "is_available");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_areas" ADD CONSTRAINT "zone_areas_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_from_zone_id_fkey" FOREIGN KEY ("from_zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_to_zone_id_fkey" FOREIGN KEY ("to_zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_pickup_zone_id_fkey" FOREIGN KEY ("pickup_zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_drop_zone_id_fkey" FOREIGN KEY ("drop_zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_tracking_events" ADD CONSTRAINT "order_tracking_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_tracking_events" ADD CONSTRAINT "order_tracking_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_reschedules" ADD CONSTRAINT "delivery_reschedules_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_reschedules" ADD CONSTRAINT "delivery_reschedules_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_availability" ADD CONSTRAINT "agent_availability_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_availability" ADD CONSTRAINT "agent_availability_current_zone_id_fkey" FOREIGN KEY ("current_zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
