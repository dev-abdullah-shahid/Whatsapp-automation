const { prisma } = require('../db');
const { calculateLeadScore } = require('../services/leadCapture.service');

async function getOverview(req, res) {
  try {
    const [
      totalLeads,
      totalMessages,
      hotLeads,
      warmLeads,
      coldLeads,
      convertedLeads,
      todayLeads
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.message.count(),
      prisma.lead.count({ where: { tag: 'HOT' } }),
      prisma.lead.count({ where: { tag: 'WARM' } }),
      prisma.lead.count({ where: { tag: 'COLD' } }),
      prisma.lead.count({ where: { status: 'CONVERTED' } }),
      prisma.lead.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) }
        }
      })
    ]);

    const repliedLeads = await prisma.lead.count({
      where: { messages: { some: { direction: 'INBOUND' } } }
    });

    const inboundMessages = await prisma.message.count({
      where: { direction: 'INBOUND' }
    });

    const outboundMessages = await prisma.message.count({
      where: { direction: 'OUTBOUND' }
    });

    res.json({
      success: true,
      data: {
        leads: {
          total: totalLeads,
          today: todayLeads,
          hot: hotLeads,
          warm: warmLeads,
          cold: coldLeads,
          converted: convertedLeads
        },
        messages: {
          total: totalMessages,
          inbound: inboundMessages,
          outbound: outboundMessages
        },
        rates: {
          responseRate: totalLeads > 0
            ? ((repliedLeads / totalLeads) * 100).toFixed(1) + '%'
            : '0%',
          conversionRate: totalLeads > 0
            ? ((convertedLeads / totalLeads) * 100).toFixed(1) + '%'
            : '0%'
        }
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

    const total = newLeads + contacted + qualified + converted + lost;

    res.json({
      success: true,
      data: {
        stages: { new: newLeads, contacted, qualified, converted, lost },
        total,
        conversionRate: total > 0
          ? ((converted / total) * 100).toFixed(1) + '%'
          : '0%'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getLeadGrowth(req, res) {
  try {
    const { days = 7 } = req.query;
    const results = [];

    for (let i = parseInt(days) - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await prisma.lead.count({
        where: {
          createdAt: { gte: date, lt: nextDate }
        }
      });

      results.push({
        date: date.toISOString().split('T')[0],
        leads: count
      });
    }

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { getOverview, getFunnel, getLeadGrowth };