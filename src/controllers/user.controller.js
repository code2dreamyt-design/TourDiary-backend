import User from "../models/User.js";
import {
  deleteProfilePic,
  uploadProfilePic,
} from "../services/cloudinary.service.js";

export const updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    if (!req.file) {
      return res.status(400).json({ message: "No image was uploaded" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User Not Found" });
    const previousPublicId = user.profilepic?.publicId;
    let uploadResult;
    try {
      uploadResult = await uploadProfilePic(req.file.buffer);
    } catch (error) {
      console.log("Cloudinary upload failed:", error.message);
      return res
        .status(502)
        .json({ message: "Image upload failed, please try again" });
    }
    console.log(uploadResult)
    user.profilepic = {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    };
    await user.save();
    if (previousPublicId) {
      deleteProfilePic(previousPublicId).catch((error) =>
        console.log("Old profile picture cleanup failed:", error.message),
      );
    }
    return res.status(200).json({ user });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const removeProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User Not Found" });

    const publicIdToDelete = user.profilepic?.publicId;
    if (!publicIdToDelete) {
      return res.status(400).json({ message: "No profile picture to remove" });
    }

    user.profilepic.url = undefined;
    user.profilepic.publicId = undefined;
    await user.save();

    deleteProfilePic(publicIdToDelete).catch((error) =>
      console.log("Old profile picture cleanup failed:", error.message),
    );

    return res.status(200).json({ message: "Profile picture has been removed" });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const nameUpdate = async (req,res)=>{
    try {
        const userId = req.userId;
        const {name} = req.body;
        const user = await User.findOneAndUpdate(
            { _id:userId, name:{$ne:name} },
            {name},
            { returnDocument:"after" }
        );
        if(!user) {
            return res.status(400).json({ message: "New name must be different from your current name" });
        }
        return res.status(200).json({message:"Name has been updated", user});
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

export const completeOrUpdateDesignation = async (req,res)=>{
    try {
        const userId = req.userId;
        const {designation,usualTourStart,beatName,forestBlock,forestRange} = req.body;
        const user = await User.findById(userId);
        if(!user){
            return res.status(404).json({message:"User Not Found"});
        }
        user.designation=designation;
        user.usualTourStart=usualTourStart;
        user.beatName=beatName;
        user.forestBlock=forestBlock;
        user.forestRange=forestRange;
        user.profileCompleted = true;
        await user.save();
        return res.status(200).json({message:"Professional details updated", user});
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

export const dobUpdate = async (req, res) => {
    try {
        const userId = req.userId;
        const { dob } = req.body;

        const user = await User.findOneAndUpdate(
            { _id: userId, dob: { $exists: false } },
            { dob },
            { returnDocument: "after" },
        );

        if (!user) {
            return res.status(400).json({
                message: "Date of birth is already set. Please contact support with valid documents to change it.",
            });
        }

        return res.status(200).json({ message: "Date of birth has been set", user });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};