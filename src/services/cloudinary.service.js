import cloudinary from "../config/cloudinary.js";
import {Readable} from "stream"
const PROFILE_PIC_TRANSFORMATION = [
    {
        width:500,
        height:500,
        crop:"fill",
        gravity:"face",
        quality:"auto:eco",
        fetch_format: "auto"
    }
];

export const uploadProfilePic = (buffer)=>{
    return new Promise((resolve,reject)=>{
        const uploadStream = cloudinary.uploader.upload_stream({
            folder:"profile_pics",resource_type:"image",transformation:PROFILE_PIC_TRANSFORMATION
        },
        (error,result)=>(error ? reject(error):resolve(result))
    );
    Readable.from(buffer).pipe(uploadStream);
    });
}

export const deleteProfilePic = (publicId)=>{
    return cloudinary.uploader.destroy(publicId,{resource_type:"image"});
}