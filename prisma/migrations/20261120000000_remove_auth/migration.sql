-- Login was dropped from scope: the app is used without accounts, so the
-- audit trail no longer records who made a change (only what and when).
-- DDL on order_events is not blocked by the append-only row trigger.

-- DropForeignKey
ALTER TABLE "order_events" DROP CONSTRAINT "order_events_actor_id_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_fkey";

-- AlterTable
ALTER TABLE "order_events" DROP COLUMN "actor_id";

-- DropTable
DROP TABLE "sessions";

-- DropTable
DROP TABLE "users";
