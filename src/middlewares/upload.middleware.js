import multer, { memoryStorage } from "multer";

const MAX_FILE_SIZE_BYTES=5 * 1024 *1024;
const ALLOWED_MIME_TYPE = ["image/jpg","image/jpeg","image/png","image/webp"]
const uploader = multer({
    storage:memoryStorage(),
    limits:{fileSize:MAX_FILE_SIZE_BYTES,files:1},
    fileFilter:(req,file,cb)=>{
        if(!ALLOWED_MIME_TYPE.includes(file.mimetype)){
            const err = new Error("Only JPG, PNG, or WEBP images are allowed");
            err.status=400;
            return cb(err);
        }
        return cb(null,true);
    }
}).single("profilePic");

export const uploadProfilePicMiddleware = (req, res, next) =>{

    uploader(req,res,(err)=>{
        if(!err) return next();
        if(err instanceof multer.MulterError){
            if(err.code==="LIMIT_FILE_SIZE") return res.status(400).json({message:"Image must be 5MB or smaller"});
            if(err.code==="LIMIT_UNEXPECTED_FILE") return res.status(400).json({ message: "Send the image under the 'profilepic' field" });

        }
         
        return res.status(err.status || 400).json({ message: err.message });
    });
}