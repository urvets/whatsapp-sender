export class DeviceResponseDto {
  id!: string;
  name!: string;
  status!: string;
  qr!: string | null;
  number!: string | null;

  static from(session: any): DeviceResponseDto {
    return {
      id: session.id,
      name: session.name,
      status: session.status,
      qr: session.qr || null,
      number: session.number || null,
    };
  }
}

export class PaginatedDevicesResponseDto {
  status!: boolean;
  data!: DeviceResponseDto[];
  metadata!: {
    totalData: number;
    totalPage: number;
    page: number;
    limit: number;
  };
}
