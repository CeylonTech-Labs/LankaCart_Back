import { Request, RequestHandler } from "express";
import {
  changeCurrentUserPassword,
  getCurrentUser,
  loginUser,
  registerCustomer,
  registerSeller,
  registerUser,
  updateCurrentUser
} from "../services/auth.service";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/errors";

const requireUserId = (req: Request) => {
  if (!req.user?.id) {
    throw new AppError("Authentication is required", 401);
  }

  return req.user.id;
};

export const register: RequestHandler = async (req, res, next) => {
  try {
    const result = await registerUser(req.body);
    return sendSuccess(res, {
      statusCode: 201,
      message: "Account created successfully",
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const registerCustomerAccount: RequestHandler = async (req, res, next) => {
  try {
    const result = await registerCustomer(req.body);
    return sendSuccess(res, {
      statusCode: 201,
      message: "Customer account created successfully",
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const registerSellerAccount: RequestHandler = async (req, res, next) => {
  try {
    const result = await registerSeller(req.body);
    return sendSuccess(res, {
      statusCode: 201,
      message: "Seller account submitted for approval",
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const result = await loginUser(req.body);
    return sendSuccess(res, {
      message: "Logged in successfully",
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const me: RequestHandler = async (req, res, next) => {
  try {
    const user = await getCurrentUser(requireUserId(req));
    return sendSuccess(res, {
      message: "Logged-in user profile",
      data: user
    });
  } catch (error) {
    return next(error);
  }
};

export const updateProfile: RequestHandler = async (req, res, next) => {
  try {
    const user = await updateCurrentUser(requireUserId(req), req.body);
    return sendSuccess(res, {
      message: "Profile updated successfully",
      data: user
    });
  } catch (error) {
    return next(error);
  }
};

export const changePassword: RequestHandler = async (req, res, next) => {
  try {
    await changeCurrentUserPassword(requireUserId(req), req.body);
    return sendSuccess(res, {
      message: "Password changed successfully"
    });
  } catch (error) {
    return next(error);
  }
};

export const logout: RequestHandler = (_req, res) => {
  return sendSuccess(res, {
    message: "Logout successful. Please remove the token on the client."
  });
};

export const forgotPassword: RequestHandler = (_req, res) => {
  return sendSuccess(res, {
    message: "If the email exists, a password reset link will be sent."
  });
};

export const resetPassword: RequestHandler = (_req, res) => {
  return sendSuccess(res, {
    message: "Password reset endpoint placeholder. Token verification will be added later."
  });
};
