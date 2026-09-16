import multer from "multer";
import { AppError } from "../utils/errors";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 8
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      return callback(new AppError("Only image files are allowed", 400));
    }

    return callback(null, true);
  }
});
