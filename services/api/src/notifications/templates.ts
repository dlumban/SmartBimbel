import { NotificationType } from "@prisma/client";

interface NotificationTemplate {
  subject: string;
  body: string;
}

export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  BOOKING_REQUESTED: {
    subject: "Permintaan booking baru",
    body: "Anda menerima permintaan booking baru. Segera tinjau dan berikan respons.",
  },
  BOOKING_ACCEPTED: {
    subject: "Booking diterima",
    body: "Booking Anda telah diterima.",
  },
  BOOKING_DECLINED: {
    subject: "Booking ditolak",
    body: "Booking Anda telah ditolak.",
  },
  BOOKING_COUNTER_PROPOSED: {
    subject: "Usulan waktu baru",
    body: "Tutor mengusulkan waktu baru untuk booking Anda.",
  },
  BOOKING_EXPIRED: {
    subject: "Booking kedaluwarsa",
    body: "Booking Anda kedaluwarsa karena tidak ada respons tepat waktu.",
  },
  BOOKING_RESCHEDULE_PROPOSED: {
    subject: "Usulan jadwal ulang",
    body: "Ada usulan jadwal ulang untuk booking Anda.",
  },
  BOOKING_RESCHEDULE_ACCEPTED: {
    subject: "Jadwal ulang diterima",
    body: "Usulan jadwal ulang Anda diterima.",
  },
  BOOKING_RESCHEDULE_DECLINED: {
    subject: "Jadwal ulang ditolak",
    body: "Usulan jadwal ulang Anda ditolak - jadwal semula tetap berlaku.",
  },
  BOOKING_CANCELLED: {
    subject: "Booking dibatalkan",
    body: "Booking Anda telah dibatalkan.",
  },
  BOOKING_NO_SHOW_REPORTED: {
    subject: "Laporan tidak hadir",
    body: "Sesi Anda dilaporkan tidak dihadiri oleh salah satu pihak.",
  },
  BOOKING_REMINDER_24H: {
    subject: "Pengingat sesi (24 jam lagi)",
    body: "Sesi belajar Anda akan dimulai dalam 24 jam.",
  },
  BOOKING_REMINDER_1H: {
    subject: "Pengingat sesi (1 jam lagi)",
    body: "Sesi belajar Anda akan dimulai dalam 1 jam.",
  },
  MESSAGE_RECEIVED: {
    subject: "Pesan baru",
    body: "Anda menerima pesan baru terkait booking Anda.",
  },
  BOOKING_CONFIRMED: {
    subject: "Pembayaran berhasil - booking terkonfirmasi",
    body: "Pembayaran Anda berhasil. Booking telah terkonfirmasi.",
  },
  PAYMENT_FAILED: {
    subject: "Pembayaran gagal",
    body: "Pembayaran untuk booking Anda gagal atau kedaluwarsa. Silakan coba lagi.",
  },
  PAYOUT_REQUESTED: {
    subject: "Permintaan pencairan dana diterima",
    body: "Permintaan pencairan dana Anda sedang diproses.",
  },
  PAYOUT_STATUS_CHANGED: {
    subject: "Status pencairan dana diperbarui",
    body: "Status permintaan pencairan dana Anda telah diperbarui.",
  },
  DISPUTE_RAISED: {
    subject: "Sengketa baru diajukan",
    body: "Sebuah sengketa telah diajukan terkait booking Anda.",
  },
  DISPUTE_RESOLVED: {
    subject: "Sengketa telah diselesaikan",
    body: "Sengketa terkait booking Anda telah diselesaikan.",
  },
  REVIEW_PROMPT: {
    subject: "Bagaimana sesi Anda?",
    body: "Sesi Anda telah selesai. Beri rating dan ulasan untuk tutor Anda.",
  },
  SESSION_EDITED: {
    subject: "Detail sesi diperbarui",
    body: "Tutor Anda memperbarui detail sesi yang telah dijadwalkan.",
  },
};
