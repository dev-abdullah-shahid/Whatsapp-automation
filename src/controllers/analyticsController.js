const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getOverview(req, res) {
  try {
    const [totalLeads, totalMessages, hotLeads, convertedLeads] = await Promise.all([
      prisma.lead.count(),
      prisma.message.count(),
      prisma.lead.count({ where: { tag: 'HOT' } }),
      prisma.lead.count({ where: { status: 'CONVERTED' } })
    ]);

    const repliedLeads = await prisma.lead.count({
      where: { messages: { some: { direction: 'INBOUND' } } }
    });

    res.json({
      success: true,
      data: {
        totalLeads,
        totalMessages,
        hotLeads,
        convertedLeads,
        responseRate: totalLeads > 0
          ? ((repliedLeads / totalLeads) * 100).toFixed(1) + '%'
          : '0%'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getFunnel(req, res) {
  try {
    const [newLeads, contacted, qualified, converted, lost] = await Promise.all([
      prisma.lead.count({ where: { status: 'NEW' } }),
      prisma.lead.count({ where: { status: 'CONTACTED' } }),
      prisma.lead.count({ where: { status: 'QUALIFIED' } }),
      prisma.lead.count({ where: { status: 'CONVERTED' } }),
      prisma.lead.count({ where: { status: 'LOST' } })
    ]);

    res.json({
      success: true,
      data: { new: newLeads, contacted, qualified, converted, lost }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { getOverview, getFunnel };