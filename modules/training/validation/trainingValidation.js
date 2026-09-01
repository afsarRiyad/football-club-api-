const { z } = require("zod");

const trainingTypes = ["TACTICAL", "PHYSICAL", "TECHNICAL", "RECOVERY", "MIXED"];
const trainingStatuses = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const attendanceStatuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

exports.createTrainingSchema = z.object({
  club: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
  team: z.string().regex(/^[a-f\d]{24}$/i, "Invalid team ID"),
  title: z.string().min(1).max(150),
  date: z.string().datetime("Invalid training date"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().optional(),
  type: z.enum(trainingTypes).optional(),
  description: z.string().optional(),
  coach: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

exports.updateTrainingSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  date: z.string().datetime().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().optional(),
  type: z.enum(trainingTypes).optional(),
  description: z.string().optional(),
  coach: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  status: z.enum(trainingStatuses).optional(),
});

exports.attendanceSchema = z.object({
  playerId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid player ID"),
  status: z.enum(attendanceStatuses),
  notes: z.string().optional(),
});

exports.trainingIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid training ID"),
});
