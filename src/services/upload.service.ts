import { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../config/cloudinary";
import { AppError } from "../utils/errors";

export const uploadImageBuffer = async (buffer: Buffer, folder = "lankacart/products") => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new AppError("Cloudinary credentials are not configured", 500);
  }

  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image"
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }

        resolve(result);
      }
    );

    stream.end(buffer);
  });
};

export const deleteCloudinaryImage = async (publicId?: string | null) => {
  if (!publicId) {
    return;
  }

  await cloudinary.uploader.destroy(publicId);
};
