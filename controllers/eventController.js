const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const { uploadBufferToCloudinary, buildOptimizedImageUrl } = require("../utils/cloudinary");

const normalizeEventNotification = (doc, userId) => {
  const obj = doc.toObject();
  const event = obj.event || {};
  const registeredUsers = Array.isArray(event.registeredUsers) ? event.registeredUsers : [];
  const registeredCount = registeredUsers.length;
  const totalSpots = typeof event.totalSpots === "number" ? event.totalSpots : 0;
  const spotsLeft = Math.max(0, totalSpots - registeredCount);
  const isRegistered = userId ? registeredUsers.some((id) => String(id) === String(userId)) : false;

  return {
    _id: obj._id,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    title: event.title || "",
    description: event.description || "",
    category: event.category || "competition",
    dateLabel: event.dateLabel || "",
    timeLabel: event.timeLabel || "",
    location: event.location || "",
    posterUrl: buildOptimizedImageUrl({ publicId: event.posterPublicId, fallbackUrl: event.posterUrl }),
    totalSpots,
    registeredCount,
    spotsLeft,
    isRegistered
  };
};

const listEvents = async (req, res, next) => {
  try {
    const category = String(req.query.category || "all").toLowerCase();
    const filter = { type: "event" };
    if (category !== "all") filter["event.category"] = category;

    const docs = await Notification.find(filter).sort({ createdAt: -1 });
    return res.json(docs.map((d) => normalizeEventNotification(d, req.user.id)));
  } catch (error) {
    next(error);
  }
};

const createEvent = async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const category = String(req.body.category || "").trim().toLowerCase();
    const dateLabel = String(req.body.dateLabel || "").trim();
    const timeLabel = String(req.body.timeLabel || "").trim();
    const location = String(req.body.location || "").trim();
    const totalSpots = parseInt(req.body.totalSpots || "0", 10);

    if (!title) return res.status(400).json({ message: "Title is required" });
    if (!description) return res.status(400).json({ message: "Description is required" });
    if (!["hackathon", "workshop", "competition", "cultural", "sports"].includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }
    if (!dateLabel) return res.status(400).json({ message: "Date is required" });
    if (!timeLabel) return res.status(400).json({ message: "Time is required" });
    if (!location) return res.status(400).json({ message: "Location is required" });
    if (!Number.isFinite(totalSpots) || totalSpots <= 0) {
      return res.status(400).json({ message: "Total spots must be a positive number" });
    }

    const eventId = new mongoose.Types.ObjectId();
    let posterUrl = "";
    let posterPublicId = "";
    if (req.file) {
      const isImage = String(req.file.mimetype || "").toLowerCase().startsWith("image/");
      if (!isImage) return res.status(400).json({ message: "Poster must be an image" });

      const uploaded = await uploadBufferToCloudinary({
        buffer: req.file.buffer,
        publicId: `events/${eventId.toString()}`,
        resourceType: "image",
        overwrite: true,
        invalidate: true
      });
      posterUrl = uploaded.secure_url;
      posterPublicId = uploaded.public_id;
    }

    // Store as a Notification doc (same collection), using creator as both userId/actorId.
    const created = await Notification.create({
      _id: eventId,
      userId: req.user.id,
      actorId: req.user.id,
      type: "event",
      isRead: false,
      event: {
        title,
        description,
        category,
        dateLabel,
        timeLabel,
        location,
        totalSpots,
        posterUrl,
        posterPublicId,
        registeredUsers: []
      }
    });

    return res.status(201).json(normalizeEventNotification(created, req.user.id));
  } catch (error) {
    next(error);
  }
};

const registerForEvent = async (req, res, next) => {
  try {
    const eventId = req.params.eventId;
    if (!mongoose.isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid event id" });
    }

    const doc = await Notification.findOne({ _id: eventId, type: "event" });
    if (!doc) return res.status(404).json({ message: "Event not found" });

    const uid = req.user.id;
    const registeredUsers = doc.event?.registeredUsers || [];
    const already = registeredUsers.some((id) => String(id) === String(uid));
    if (!already) {
      const totalSpots = typeof doc.event?.totalSpots === "number" ? doc.event.totalSpots : 0;
      if (registeredUsers.length >= totalSpots) {
        return res.status(409).json({ message: "No spots left for this event." });
      }
      doc.event.registeredUsers.addToSet(uid);
      await doc.save();
    }

    return res.json(normalizeEventNotification(doc, uid));
  } catch (error) {
    next(error);
  }
};

module.exports = { listEvents, createEvent, registerForEvent };
