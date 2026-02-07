import Chatlog from '../models/ChatlogModel';

export const getChatlogById = async (id: string) => {
  return await Chatlog.findById(id);
};

export const getChatlogs = async (filters: any) => {
  const query: any = {};

  if (filters.studentId) query.studentId = filters.studentId;
  if (filters.driverId) query.driverId = filters.driverId;
  if (filters.routeId) query.routeId = filters.routeId;

  if (filters.startDate || filters.endDate) {
    query.time = {};
    if (filters.startDate) query.time.$gte = new Date(filters.startDate);
    if (filters.endDate) query.time.$lte = new Date(filters.endDate);
  }

  return await Chatlog.find(query);
};