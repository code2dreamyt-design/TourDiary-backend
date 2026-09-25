import {v2 as cloudinary} from "cloudinary";
import { cloudinaryApiKey, cloudinaryCloud, cloudinarySecret } from "./env.js";

cloudinary.config({
    cloud_name:cloudinaryCloud,
    api_key:cloudinaryApiKey,
    api_secret:cloudinarySecret,
    secure:true
});
export default cloudinary;