import { prisma } from "../lib/db";
import { changeStatus, createOrder } from "../lib/orders/service";
import { addDays, vnDayStartUtc, vnToday } from "../lib/time";

type SeedOrder = {
  customerName: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  status: "NEW" | "DELIVERED" | "CANCELLED";
  // Business day (Vietnam time) the order was created, counted back from today,
  // and the local time of day. null keeps the real creation time (now).
  daysAgo: number | null;
  time?: [hour: number, minute: number];
};

const ORDERS: SeedOrder[] = [
  { customerName: "Nguyễn Văn An", productName: "Bút bi Thiên Long", quantity: 50, unitPrice: "5000", status: "DELIVERED", daysAgo: 6, time: [9, 15] },
  { customerName: "Trần Thị Bình", productName: "Vở kẻ ngang 200 trang", quantity: 20, unitPrice: "18500", status: "DELIVERED", daysAgo: 6, time: [14, 0] },
  { customerName: "Lê Hoàng Cường", productName: "Giấy A4 Double A", quantity: 10, unitPrice: "95000", status: "CANCELLED", daysAgo: 5, time: [10, 30] },
  { customerName: "Phạm Minh Dũng", productName: "Máy tính Casio FX-580", quantity: 2, unitPrice: "680000", status: "DELIVERED", daysAgo: 5, time: [16, 45] },
  { customerName: "Hoàng Thu Hà", productName: "Bìa hồ sơ", quantity: 100, unitPrice: "3500.50", status: "DELIVERED", daysAgo: 4, time: [8, 5] },
  { customerName: "Vũ Đức Huy", productName: "Mực in HP 680", quantity: 3, unitPrice: "325000", status: "NEW", daysAgo: 4, time: [11, 20] },
  { customerName: "Đặng Ngọc Lan", productName: "Bút dạ quang", quantity: 30, unitPrice: "12000", status: "DELIVERED", daysAgo: 3, time: [13, 10] },
  { customerName: "Bùi Quang Minh", productName: "Kẹp giấy", quantity: 200, unitPrice: "800", status: "CANCELLED", daysAgo: 3, time: [15, 30] },
  // 00:30 Vietnam time = 17:30 UTC of the previous day: it must appear on this
  // day (not the day before) in the revenue report.
  { customerName: "Đỗ Thị Ngân", productName: "Sổ tay bìa da", quantity: 5, unitPrice: "145000", status: "DELIVERED", daysAgo: 2, time: [0, 30] },
  { customerName: "Ngô Văn Phúc", productName: "Băng keo trong", quantity: 40, unitPrice: "9500", status: "DELIVERED", daysAgo: 2, time: [10, 0] },
  { customerName: "Dương Thanh Quang", productName: "Ghim bấm số 10", quantity: 25, unitPrice: "6000", status: "NEW", daysAgo: 2, time: [17, 40] },
  { customerName: "Lý Thị Sương", productName: "Thước kẻ 30cm", quantity: 60, unitPrice: "7000", status: "DELIVERED", daysAgo: 1, time: [9, 0] },
  { customerName: "Mai Văn Tài", productName: "Hộp bút", quantity: 8, unitPrice: "55000", status: "CANCELLED", daysAgo: 1, time: [23, 50] },
  { customerName: "Trịnh Thị Uyên", productName: "Phong bì A5", quantity: 300, unitPrice: "1200", status: "NEW", daysAgo: null },
  { customerName: "Cao Văn Vinh", productName: "Bảng trắng 60x80", quantity: 1, unitPrice: "450000", status: "NEW", daysAgo: null },
];

// Converts "N days ago at hh:mm Vietnam time" into a UTC instant.
function vnTimeToUtc(daysAgo: number, [hour, minute]: [number, number]): Date {
  const dayStart = vnDayStartUtc(addDays(vnToday(), -daysAgo));
  return new Date(dayStart.getTime() + (hour * 60 + minute) * 60 * 1000);
}

async function main() {
  // Clearing the table makes the seed re-runnable. This bypasses the service on
  // purpose: the service (rightly) refuses to delete finalised orders.
  await prisma.order.deleteMany();

  for (const seed of ORDERS) {
    // Writes go through the service so seed data obeys the same rules
    // (validation, server-computed amount, allowed transitions) as real data.
    const order = await createOrder(seed);
    if (seed.status !== "NEW") {
      await changeStatus(order.id, { status: seed.status });
    }
    // createdAt is server-controlled, so the service offers no way to set it.
    // Back-dating is only needed to spread demo data over several days.
    if (seed.daysAgo !== null && seed.time) {
      await prisma.order.update({
        where: { id: order.id },
        data: { createdAt: vnTimeToUtc(seed.daysAgo, seed.time) },
      });
    }
  }

  console.log(`Đã tạo ${ORDERS.length} đơn hàng mẫu.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
