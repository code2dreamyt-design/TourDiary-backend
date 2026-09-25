import { z } from "zod";

export const signUpSchema = z.object({
    name:z.string().trim().min(3,"Name is required").max(50,"Name must be under 50 characters"),
    email:z.string().email("Invalid email address"),
    password:z.string().min(8,"Password must be at least 8 characters").max(72, "Password must be under 72 characters"),
    dob: z.string().optional()
});

export const loginSchema = z.object({
    email:z.string().email("Invalid email address"),
    password:z.string().min(1,"Password is required").max(72, "Password must be under 72 characters"),
});

export const resetPasswordSchema = z.object({
    newPassword:z.string().min(8,"Password must be at least 8 characters").max(72, "Password must be under 72 characters"),
});
export const forgetPasswordSchema = z.object({
    email:z.string().email("Invalid email address"),
});

export const changePasswordSchema = z.object({
    currentPassword:z.string().min(1,"Current Password required").max(72, "Password must be under 72 characters"),
    newPassword:z.string().min(8,"Password must be at least 8 characters").max(72, "Password must be under 72 characters"),
});

export const refrshSchema = z.object({
    refreshToken:z.string().min(1,"Refresh token is required")
});

export const nameUpdateSchema = z.object({
    name:z.string().trim().min(3,"Name must be at least 3 characters long").max(50,"Name must be under 50 characters")
});

export const completeDesignationSchema = z.object({
    designation: z.enum(["Van Mitra", "Forest Guard","Forest Worker","Others"]),
    usualTourStart:z.string().trim().min(1,"Place name is required").max(50,"Must be under 50 characters"),
    beatName:z.string().trim().min(1,"Beat name is required").max(50,"Must be under 50 characters"),
    forestBlock:z.string().trim().min(1,"Block name is required").max(50,"Must be under 50 characters"),
    forestRange:z.string().trim().min(1,"Range name is required").max(50,"Must be under 50 characters"),
});
