import linksModel from "./model/links.model.js";
import clicksModel from "./model/clicks.model.js";
import { UAParser } from "ua-parser-js";
import geoip from "geoip-lite";
import requestIp from "request-ip";

export const createLink = async (req, res) => {
  try {
    const { originalURL, expDate, alias } = req.body;
    if (!originalURL) {
      return res.status(500).json({ error: "Original URL not found" });
    }
    const newLink = await linksModel.create({
      originalURL: originalURL,
      alias: alias ? alias : undefined,
      expDate: expDate ? expDate : undefined,
    });
    return res.status(201).json({
      ok: true,
      data: newLink,
    });
  } catch (error) {
    res.status(500).json({ error: error });
  }
};
function getDeviceType(ua) {
  if (ua.device.type === "mobile") return "mobile";
  if (ua.device.type === "tablet") return "tablet";
  if (/bot|crawl|spider/i.test(ua.ua)) return "bot";
  return "desktop";
}
export const getLink = async (req, res) => {
  try {
    const { id } = req.params;
    const clientIp = requestIp.getClientIp(req) || req.ip;
    const parser = new UAParser(req.headers["user-agent"]);
    const ua = parser.getResult();

    const geo = geoip.lookup(clientIp);
    const deviceType = getDeviceType(ua);

    if (!id) {
      return res.status(500).json({ error: "No ID found" });
    }
    const ogLink = await linksModel.findById(id);
    if (ogLink.expDate > Date.now) {
      return res.status(401).json({ error: "Expired Link" });
    }
    const clickData = await clicksModel.create({
      linkId: id,
      ipAddress: clientIp,
      userAgent: req.headers["user-agent"],
      deviceType,
      browser: ua.browser.name,
      browserVersion: ua.browser.version,
      os: ua.os.name,
      osVersion: ua.os.version,
      deviceVendor: ua.device.vendor,
      deviceModel: ua.device.model,
      country: geo?.country,
      region: geo?.region,
      city: geo?.city,
      timezone: geo?.timezone,
      referrer: req.headers["referer"] || req.headers["referrer"],
    });
    return res.redirect(ogLink.originalURL);
  } catch (error) {
    res.status(500).json({ error: error });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const totalLinks = await linksModel.countDocuments();
    const totalClicks = await clicksModel.countDocuments();

    const recentLinks = await linksModel
      .find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const popularLinks = await clicksModel.aggregate([
      {
        $group: {
          _id: "$linkId",
          clicks: { $sum: 1 },
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "links",
          localField: "_id",
          foreignField: "_id",
          as: "link",
        },
      },
      { $unwind: "$link" },
      {
        $project: {
          _id: 0,
          linkId: "$_id",
          originalURL: "$link.originalURL",
          clicks: 1,
          alias: "$link.alias",
        },
      },
    ]);

    const devices = await clicksModel.aggregate([
      {
        $group: {
          _id: "$deviceType",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const countries = await clicksModel.aggregate([
      {
        $group: {
          _id: "$country",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const dailyClicks = await clicksModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totals: {
          links: totalLinks,
          clicks: totalClicks,
        },
        recentLinks,
        popularLinks,
        devices,
        countries,
        dailyClicks,
      },
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

// export const getLinkStats = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const link = await linksModel.findById(id);
//     if (!link) return res.status(404).json({ error: "Link not found" });

//     const totalClicks = await clicksModel.countDocuments({ linkId: id });

//     const devices = await clicksModel.aggregate([
//       { $match: { linkId: id } },
//       {
//         $group: {
//           _id: "$deviceType",
//           count: { $sum: 1 },
//         },
//       },
//     ]);

//     const referrers = await clicksModel.aggregate([
//       { $match: { linkId: id, referrer: { $exists: true } } },
//       {
//         $group: {
//           _id: "$referrer",
//           count: { $sum: 1 },
//         },
//       },
//       { $sort: { count: -1 } },
//       { $limit: 10 },
//     ]);

//     const timeline = await clicksModel.aggregate([
//       { $match: { linkId: id } },
//       {
//         $group: {
//           _id: {
//             $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
//           },
//           count: { $sum: 1 },
//         },
//       },
//       { $sort: { _id: 1 } },
//       { $limit: 30 },
//     ]);

//     res.status(200).json({
//       success: true,
//       data: {
//         link: {
//           id: link._id,
//           originalURL: link.originalURL,
//           alias: link.alias,
//           createdAt: link.createdAt,
//           expiresAt: link.expDate,
//         },
//         clicks: {
//           total: totalClicks,
//         },
//         devices,
//         referrers,
//         timeline,
//       },
//     });
//   } catch (error) {
//     console.error("Link Stats Error:", error);
//     res.status(500).json({
//       success: false,
//       error: "Internal server error",
//     });
//   }
// };
export const getLinkStats = async (req, res) => {
  try {
    const { id } = req.params;

    // Get basic link info
    const link = await linksModel.findById(id).lean();
    if (!link) return res.status(404).json({ error: "Link not found" });

    // Parallelize all database queries for better performance
    const [
      totalClicks,
      uniqueClicks,
      devices,
      browsers,
      countries,
      referrers,
      timeline,
      hourlyStats,
      osStats,
      ispStats,
    ] = await Promise.all([
      // Total clicks count
      clicksModel.countDocuments({ linkId: id }),

      // Unique clicks count (based on IP)
      clicksModel.aggregate([
        { $match: { linkId: id } },
        { $group: { _id: "$ipAddress" } },
        { $count: "uniqueClicks" },
      ]),

      // Device distribution
      clicksModel.aggregate([
        { $match: { linkId: id } },
        { $group: { _id: "$deviceType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Browser distribution
      clicksModel.aggregate([
        { $match: { linkId: id } },
        {
          $group: {
            _id: {
              name: "$browser",
              version: "$browserVersion",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Country distribution
      clicksModel.aggregate([
        { $match: { linkId: id, country: { $exists: true } } },
        { $group: { _id: "$country", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Referrer data
      clicksModel.aggregate([
        { $match: { linkId: id, referrer: { $exists: true, $ne: null } } },
        { $group: { _id: "$referrer", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Daily timeline (30 days)
      clicksModel.aggregate([
        { $match: { linkId: id } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ]),

      // Hourly distribution
      clicksModel.aggregate([
        { $match: { linkId: id } },
        {
          $group: {
            _id: {
              hour: { $hour: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // OS distribution
      clicksModel.aggregate([
        { $match: { linkId: id } },
        {
          $group: {
            _id: {
              name: "$os",
              version: "$osVersion",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),

      // ISP/Network data (if available)
      clicksModel.aggregate([
        { $match: { linkId: id, isp: { $exists: true } } },
        { $group: { _id: "$isp", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    // Process the results
    const uniqueClicksCount = uniqueClicks[0]?.uniqueClicks || 0;
    const hourlyData = Array(24).fill(0);
    hourlyStats.forEach((hour) => {
      hourlyData[hour._id.hour] = hour.count;
    });

    res.status(200).json({
      success: true,
      data: {
        link: {
          id: link._id,
          originalURL: link.originalURL,
          alias: link.alias,
          createdAt: link.createdAt,
          expiresAt: link.expDate,
          shortUrl: `${process.env.BASE_URL || "http://localhost:5000"}/${
            link._id
          }`,
        },
        clicks: {
          total: totalClicks,
          unique: uniqueClicksCount,
          conversionRate:
            totalClicks > 0
              ? Math.round((uniqueClicksCount / totalClicks) * 100)
              : 0,
        },
        devices: devices.map((d) => ({ type: d._id, count: d.count })),
        browsers: browsers.map((b) => ({
          name: b._id.name,
          version: b._id.version,
          count: b.count,
        })),
        countries: countries.map((c) => ({ name: c._id, count: c.count })),
        referrers: referrers.map((r) => ({ url: r._id, count: r.count })),
        timeline: timeline.map((t) => ({ date: t._id, count: t.count })),
        hourlyTraffic: hourlyData.map((count, hour) => ({
          hour: `${hour}:00`,
          count,
        })),
        operatingSystems: osStats.map((os) => ({
          name: os._id.name,
          version: os._id.version,
          count: os.count,
        })),
        networks: ispStats.map((isp) => ({
          name: isp._id,
          count: isp.count,
        })),
      },
    });
  } catch (error) {
    console.error("Link Stats Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      ...(process.env.NODE_ENV === "development" && {
        details: error.message,
        stack: error.stack,
      }),
    });
  }
};
