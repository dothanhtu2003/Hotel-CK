import type { DeskBooking, DeskRoom } from './contracts';

export function getEnrichedDemoRooms(realRooms: DeskRoom[]): DeskRoom[] {
  if (!realRooms.length) return realRooms;

  // Extract real room types from existing rooms if available
  const standardType = realRooms.find((r) => r.floor === 1)?.roomType ?? {
    id: 'type-standard',
    name: 'Standard',
    description: 'Phòng Standard tiêu chuẩn',
    nightlyPrice: '650000',
    maxGuests: 2,
  };
  const deluxeType = realRooms.find((r) => r.floor === 2)?.roomType ?? {
    id: 'type-deluxe',
    name: 'Deluxe',
    description: 'Phòng Deluxe ban công thoáng mát',
    nightlyPrice: '1000000',
    maxGuests: 3,
  };
  const suiteType = realRooms.find((r) => r.floor === 3)?.roomType ?? {
    id: 'type-suite',
    name: 'Suite',
    description: 'Phòng Suite cao cấp tiện nghi',
    nightlyPrice: '1800000',
    maxGuests: 4,
  };
  const penthouseType = {
    id: 'type-penthouse',
    name: 'Penthouse Luxury',
    description: 'Penthouse tầng thượng toàn cảnh hướng biển',
    nightlyPrice: '3200000',
    maxGuests: 6,
  };

  // Clone real rooms and enrich some empty rooms with realistic guests
  const enriched = realRooms.map((r) => {
    // If room already has checked-in booking, keep it
    if (r.bookings.some((b) => b.status === 'CHECKED_IN')) {
      return r;
    }

    // Enrich specific rooms to create a vibrant active hotel
    if (r.roomNumber === '102') {
      const demoBooking: DeskBooking = {
        id: 'demo-booking-102',
        reference: 'AN-2026-102',
        roomId: r.id,
        roomNumber: r.roomNumber,
        userId: 'demo-user-102',
        checkIn: '2026-10-28',
        checkOut: '2026-10-31',
        nights: 3,
        guestCount: 2,
        nightlyPrice: r.roomType.nightlyPrice,
        totalRoomAmount: '1950000',
        status: 'CHECKED_IN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customer: {
          id: 'cust-102',
          fullName: 'Trần Hữu Nghĩa',
          email: 'huunghia.tran@gmail.com',
          phone: '0908 123 456',
        },
      };
      return {
        ...r,
        bookings: [demoBooking, ...r.bookings],
      };
    }

    if (r.roomNumber === '203') {
      const demoBooking: DeskBooking = {
        id: 'demo-booking-203',
        reference: 'AN-2026-203',
        roomId: r.id,
        roomNumber: r.roomNumber,
        userId: 'demo-user-203',
        checkIn: '2026-10-27',
        checkOut: '2026-10-30',
        nights: 3,
        guestCount: 2,
        nightlyPrice: r.roomType.nightlyPrice,
        totalRoomAmount: '3000000',
        status: 'CHECKED_IN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customer: {
          id: 'cust-203',
          fullName: 'Đặng Thu Thảo',
          email: 'thuthao.dang@outlook.com',
          phone: '0912 888 999',
        },
      };
      return {
        ...r,
        bookings: [demoBooking, ...r.bookings],
      };
    }

    if (r.roomNumber === '301') {
      const demoBooking: DeskBooking = {
        id: 'demo-booking-301',
        reference: 'AN-2026-301',
        roomId: r.id,
        roomNumber: r.roomNumber,
        userId: 'demo-user-301',
        checkIn: '2026-10-28',
        checkOut: '2026-11-02',
        nights: 5,
        guestCount: 3,
        nightlyPrice: r.roomType.nightlyPrice,
        totalRoomAmount: '9000000',
        status: 'CHECKED_IN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customer: {
          id: 'cust-301',
          fullName: 'David Miller',
          email: 'david.miller@global.com',
          phone: '+1 555 019 301',
        },
      };
      return {
        ...r,
        bookings: [demoBooking, ...r.bookings],
      };
    }

    return r;
  });

  // Additional rooms to expand hotel to 24 rooms across 4 floors
  const additionalRooms: DeskRoom[] = [
    // Tầng 1 additions (105, 106)
    {
      id: 'mock-room-105',
      roomNumber: '105',
      floor: 1,
      roomType: standardType,
      operationalStatus: 'ACTIVE',
      housekeepingStatus: 'CLEAN',
      openTaskCount: 0,
      bookings: [
        {
          id: 'mock-b-105',
          reference: 'AN-2026-105',
          roomId: 'mock-room-105',
          roomNumber: '105',
          userId: 'mock-u-105',
          checkIn: '2026-10-28',
          checkOut: '2026-10-31',
          nights: 3,
          guestCount: 2,
          nightlyPrice: standardType.nightlyPrice,
          totalRoomAmount: '1950000',
          status: 'CHECKED_IN',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          customer: {
            id: 'c-105',
            fullName: 'Lê Văn An',
            email: 'vanan.le@gmail.com',
            phone: '0901 888 105',
          },
        },
      ],
    },
    {
      id: 'mock-room-106',
      roomNumber: '106',
      floor: 1,
      roomType: standardType,
      operationalStatus: 'ACTIVE',
      housekeepingStatus: 'CLEAN',
      openTaskCount: 0,
      bookings: [],
    },

    // Tầng 2 additions (205, 206)
    {
      id: 'mock-room-205',
      roomNumber: '205',
      floor: 2,
      roomType: deluxeType,
      operationalStatus: 'ACTIVE',
      housekeepingStatus: 'CLEAN',
      openTaskCount: 0,
      bookings: [
        {
          id: 'mock-b-205',
          reference: 'AN-2026-205',
          roomId: 'mock-room-205',
          roomNumber: '205',
          userId: 'mock-u-205',
          checkIn: '2026-10-27',
          checkOut: '2026-10-30',
          nights: 3,
          guestCount: 2,
          nightlyPrice: deluxeType.nightlyPrice,
          totalRoomAmount: '3000000',
          status: 'CHECKED_IN',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          customer: {
            id: 'c-205',
            fullName: 'Nguyễn Minh Tuấn',
            email: 'minhtuan.nguyen@yahoo.com',
            phone: '0918 333 205',
          },
        },
      ],
    },
    {
      id: 'mock-room-206',
      roomNumber: '206',
      floor: 2,
      roomType: deluxeType,
      operationalStatus: 'ACTIVE',
      housekeepingStatus: 'CLEAN',
      openTaskCount: 0,
      bookings: [],
    },

    // Tầng 3 additions (305, 306)
    {
      id: 'mock-room-305',
      roomNumber: '305',
      floor: 3,
      roomType: suiteType,
      operationalStatus: 'ACTIVE',
      housekeepingStatus: 'CLEAN',
      openTaskCount: 0,
      bookings: [
        {
          id: 'mock-b-305',
          reference: 'AN-2026-305',
          roomId: 'mock-room-305',
          roomNumber: '305',
          userId: 'mock-u-305',
          checkIn: '2026-10-28',
          checkOut: '2026-11-01',
          nights: 4,
          guestCount: 3,
          nightlyPrice: suiteType.nightlyPrice,
          totalRoomAmount: '7200000',
          status: 'CHECKED_IN',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          customer: {
            id: 'c-305',
            fullName: 'Hoàng Bích Ngọc',
            email: 'bichngoc.hoang@gmail.com',
            phone: '0938 777 305',
          },
        },
      ],
    },
    {
      id: 'mock-room-306',
      roomNumber: '306',
      floor: 3,
      roomType: suiteType,
      operationalStatus: 'ACTIVE',
      housekeepingStatus: 'CLEAN',
      openTaskCount: 0,
      bookings: [],
    },

    // Tầng 4 additions (401 -> 406 Penthouse & Executive)
    {
      id: 'mock-room-401',
      roomNumber: '401',
      floor: 4,
      roomType: penthouseType,
      operationalStatus: 'ACTIVE',
      housekeepingStatus: 'CLEAN',
      openTaskCount: 0,
      bookings: [
        {
          id: 'mock-b-401',
          reference: 'AN-2026-401',
          roomId: 'mock-room-401',
          roomNumber: '401',
          userId: 'mock-u-401',
          checkIn: '2026-10-27',
          checkOut: '2026-11-02',
          nights: 6,
          guestCount: 4,
          nightlyPrice: penthouseType.nightlyPrice,
          totalRoomAmount: '19200000',
          status: 'CHECKED_IN',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          customer: {
            id: 'c-401',
            fullName: 'Vũ Hoàng Long',
            email: 'hoanglong.vu@invest.vn',
            phone: '0989 111 401',
          },
        },
      ],
    },
    {
      id: 'mock-room-402',
      roomNumber: '402',
      floor: 4,
      roomType: penthouseType,
      operationalStatus: 'ACTIVE',
      housekeepingStatus: 'CLEAN',
      openTaskCount: 0,
      bookings: [],
    },
    {
      id: 'mock-room-403',
      roomNumber: '403',
      floor: 4,
      roomType: penthouseType,
      operationalStatus: 'ACTIVE',
      housekeepingStatus: 'CLEANING',
      openTaskCount: 1,
      bookings: [],
    },
    {
      id: 'mock-room-404',
      roomNumber: '404',
      floor: 4,
      roomType: penthouseType,
      operationalStatus: 'ACTIVE',
      housekeepingStatus: 'DIRTY',
      openTaskCount: 2,
      bookings: [],
    },
    {
      id: 'mock-room-405',
      roomNumber: '405',
      floor: 4,
      roomType: penthouseType,
      operationalStatus: 'ACTIVE',
      housekeepingStatus: 'CLEAN',
      openTaskCount: 0,
      bookings: [],
    },
    {
      id: 'mock-room-406',
      roomNumber: '406',
      floor: 4,
      roomType: penthouseType,
      operationalStatus: 'ACTIVE',
      housekeepingStatus: 'CLEAN',
      openTaskCount: 0,
      bookings: [
        {
          id: 'mock-b-406',
          reference: 'AN-2026-406',
          roomId: 'mock-room-406',
          roomNumber: '406',
          userId: 'mock-u-406',
          checkIn: '2026-10-25',
          checkOut: '2026-11-03',
          nights: 9,
          guestCount: 4,
          nightlyPrice: penthouseType.nightlyPrice,
          totalRoomAmount: '46800000',
          status: 'CHECKED_IN',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          customer: {
            id: 'c-406',
            fullName: 'Michael Chang',
            email: 'michael.chang@singapore.sg',
            phone: '+65 9123 406',
          },
        },
      ],
    },
  ];

  return [...enriched, ...additionalRooms];
}
