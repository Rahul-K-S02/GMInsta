const mongoose = require("mongoose");
const User = require("../models/User");
const { uploadBufferToCloudinary, buildOptimizedImageUrl } = require("../utils/cloudinary");
const { isAdminEmail } = require("../utils/admin");

const normalizeUserImage = (user) => {
  if (!user) return user;

  return {
    ...user,
    profilePic: buildOptimizedImageUrl({
      publicId: user.profilePicPublicId,
      fallbackUrl: user.profilePic
    })
  };
};

const normalizeProfilePayload = (user) => {
  if (!user) return user;

  const normalized = normalizeUserImage(user);
  if (Array.isArray(normalized.followers)) normalized.followers = normalized.followers.map(normalizeUserImage);
  if (Array.isArray(normalized.following)) normalized.following = normalized.following.map(normalizeUserImage);
  return normalized;
};

const buildUserResponse = (u, currentUserId, currentFollowingIds) => {
  const normalizedUser = normalizeUserImage(u);
  const followersCount = Array.isArray(u.followers) ? u.followers.length : 0;
  const followingCount = Array.isArray(u.following) ? u.following.length : 0;
  const isFollowing = currentUserId ? u.followers.map(String).includes(currentUserId) : false;
  const isFollower = currentUserId ? u.following.map(String).includes(currentUserId) : false;
  const mutualFriendsCount = Array.isArray(u.following)
    ? u.following.map(String).filter((id) => currentFollowingIds.has(id)).length
    : 0;

  return {
    _id: normalizedUser._id,
    username: normalizedUser.username,
    email: normalizedUser.email,
    profilePic: normalizedUser.profilePic,
    bio: normalizedUser.bio,
    followersCount,
    followingCount,
    isFollowing,
    isFollower,
    mutualFriendsCount
  };
};

const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-password").populate("followers following", "username profilePic profilePicPublicId");
    const payload = normalizeProfilePayload(user.toObject());
    return res.json({ ...payload, isAdmin: isAdminEmail(payload?.email) });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const updates = {
      bio: req.body.bio
    };
    if (req.file) {
      const imagePublicId = `profiles/${req.user.id}`;
      const uploadedImage = await uploadBufferToCloudinary({
        buffer: req.file.buffer,
        publicId: imagePublicId,
        overwrite: true,
        invalidate: true
      });
      updates.profilePic = buildOptimizedImageUrl({ publicId: uploadedImage.public_id, fallbackUrl: uploadedImage.secure_url });
      updates.profilePicPublicId = uploadedImage.public_id;
    }

    const updated = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select("-password");
    return res.json({ message: "Profile updated", user: normalizeUserImage(updated.toObject()) });
  } catch (error) {
    next(error);
  }
};

const followOrUnfollow = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) return res.status(400).json({ message: "Invalid target user ID" });
    if (targetUserId === req.user.id) return res.status(400).json({ message: "You cannot follow yourself" });

    const me = await User.findById(req.user.id);
    const target = await User.findById(targetUserId);
    if (!target) return res.status(404).json({ message: "User not found" });

    const alreadyFollowing = me.following.map(String).includes(targetUserId);
    if (alreadyFollowing) {
      me.following = me.following.filter((id) => String(id) !== targetUserId);
      target.followers = target.followers.filter((id) => String(id) !== req.user.id);
    } else {
      me.following.push(targetUserId);
      target.followers.push(req.user.id);
    }

    await me.save();
    await target.save();
    await me.populate("following", "username profilePic");
    await me.populate("followers", "username profilePic");

    const io = req.app.get("io");
    if (io && io.onlineUsers) {
      const senderSocketId = io.onlineUsers.get(req.user.id);
      const receiverSocketId = io.onlineUsers.get(targetUserId);
      const followPayload = {
        userId: target._id,
        username: target.username,
        profilePic: buildOptimizedImageUrl({ publicId: target.profilePicPublicId, fallbackUrl: target.profilePic }),
        followersCount: target.followers.length,
        followingCount: target.following.length,
        isFollowing: !alreadyFollowing,
        updatedBy: me._id,
        updatedByUsername: me.username
      };
      if (senderSocketId) {
        io.to(senderSocketId).emit("follow_update", {
          ...followPayload,
          selfUpdated: true,
          me: {
            _id: me._id,
            username: me.username,
            profilePic: buildOptimizedImageUrl({ publicId: me.profilePicPublicId, fallbackUrl: me.profilePic }),
            followersCount: me.followers.length,
            followingCount: me.following.length
          }
        });
      }
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("follow_update", followPayload);
      }
    }

    return res.json({
      message: alreadyFollowing ? "Unfollowed successfully" : "Followed successfully",
      isFollowing: !alreadyFollowing,
      me: {
        _id: me._id,
        username: me.username,
        profilePic: buildOptimizedImageUrl({ publicId: me.profilePicPublicId, fallbackUrl: me.profilePic }),
        following: me.following,
        followers: me.followers
      },
      target: {
        _id: target._id,
        username: target.username,
        profilePic: buildOptimizedImageUrl({ publicId: target.profilePicPublicId, fallbackUrl: target.profilePic }),
        followersCount: target.followers.length,
        followingCount: target.following.length
      }
    });
  } catch (error) {
    next(error);
  }
};

const getUserProfile = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const user = await User.findById(req.params.userId).select("-password").populate("followers following", "username profilePic profilePicPublicId");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(normalizeProfilePayload(user.toObject()));
  } catch (error) {
    next(error);
  }
};

const searchUsers = async (req, res, next) => {
  try {
    const q = req.query.q || "";
    const query = q ? {
      $or: [{ username: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }]
    } : {};
    const currentUser = await User.findById(req.user.id).select("following").lean();
    const currentFollowingIds = new Set((currentUser?.following || []).map(String));

    const users = await User.find(query)
      .select("username email profilePic profilePicPublicId bio followers following")
      .limit(50)
      .lean();

    const formattedUsers = users.map((u) => buildUserResponse(u, req.user.id, currentFollowingIds));

    return res.json(formattedUsers);
  } catch (error) {
    next(error);
  }
};

const discoverUsers = async (req, res, next) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 25);
    const currentUser = await User.findById(req.user.id).select("following").lean();
    const currentFollowing = Array.isArray(currentUser?.following) ? currentUser.following : [];

    const users = await User.aggregate([
      { $match: { _id: { $ne: new mongoose.Types.ObjectId(req.user.id) } } },
      {
        $project: {
          username: 1,
          email: 1,
          profilePic: 1,
          profilePicPublicId: 1,
          bio: 1,
          followersCount: { $size: { $ifNull: ["$followers", []] } },
          followingCount: { $size: { $ifNull: ["$following", []] } },
          isFollowing: { $in: [new mongoose.Types.ObjectId(req.user.id), { $ifNull: ["$followers", []] }] },
          isFollower: { $in: [new mongoose.Types.ObjectId(req.user.id), { $ifNull: ["$following", []] }] },
          mutualFriendsCount: {
            $size: {
              $setIntersection: [
                { $ifNull: ["$following", []] },
                currentFollowing
              ]
            }
          }
        }
      },
      { $sort: { mutualFriendsCount: -1, followersCount: -1 } },
      { $limit: limit }
    ]).allowDiskUse(true);

    return res.json(
      users.map((user) => ({
        ...user,
        profilePic: buildOptimizedImageUrl({
          publicId: user.profilePicPublicId,
          fallbackUrl: user.profilePic
        })
      }))
    );
  } catch (error) {
    next(error);
  }
};

module.exports = { getMyProfile, getUserProfile, updateProfile, followOrUnfollow, searchUsers, discoverUsers };
