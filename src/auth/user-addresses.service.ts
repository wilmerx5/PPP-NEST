import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Address } from './entities/address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

const DEFAULT_NEAR = { lat: 4.6323019, lng: -74.1471957 }; // Kennedy / local

@Injectable()
export class UserAddressesService {
  private readonly logger = new Logger(UserAddressesService.name);

  constructor(
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    private readonly config: ConfigService,
  ) {}

  async create(userId: string, createAddressDto: CreateAddressDto): Promise<Address> {
    if (createAddressDto.isDefault) {
      await this.addressRepository.update(
        { userId, isDefault: true },
        { isDefault: false },
      );
    }

    const hasPin =
      createAddressDto.lat != null &&
      createAddressDto.lng != null &&
      Number.isFinite(Number(createAddressDto.lat)) &&
      Number.isFinite(Number(createAddressDto.lng));

    const address = this.addressRepository.create({
      label: createAddressDto.label,
      address: createAddressDto.address,
      notes: createAddressDto.notes,
      userId,
      isDefault: createAddressDto.isDefault ?? false,
      type: createAddressDto.type ?? 'other',
      lat: hasPin ? Number(createAddressDto.lat) : null,
      lng: hasPin ? Number(createAddressDto.lng) : null,
      locationConfirmed:
        hasPin && createAddressDto.locationConfirmed !== false
          ? true
          : !!createAddressDto.locationConfirmed && hasPin,
    });

    return await this.addressRepository.save(address);
  }

  async findAll(userId: string): Promise<Address[]> {
    return await this.addressRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: number): Promise<Address> {
    const address = await this.addressRepository.findOne({
      where: { id, userId },
    });

    if (!address) {
      throw new NotFoundException(`Address with ID ${id} not found`);
    }

    return address;
  }

  async update(userId: string, id: number, updateAddressDto: UpdateAddressDto): Promise<Address> {
    const address = await this.findOne(userId, id);

    if (updateAddressDto.isDefault === true && !address.isDefault) {
      await this.addressRepository.update(
        { userId, isDefault: true },
        { isDefault: false },
      );
    }

    const nextAddressText =
      updateAddressDto.address != null ? String(updateAddressDto.address).trim() : address.address;
    const addressTextChanged =
      updateAddressDto.address != null &&
      nextAddressText.toLowerCase() !== String(address.address || '').trim().toLowerCase();

    const hasPin =
      updateAddressDto.lat != null &&
      updateAddressDto.lng != null &&
      Number.isFinite(Number(updateAddressDto.lat)) &&
      Number.isFinite(Number(updateAddressDto.lng));

    if (updateAddressDto.label != null) address.label = updateAddressDto.label;
    if (updateAddressDto.address != null) address.address = nextAddressText;
    if (updateAddressDto.notes !== undefined) address.notes = updateAddressDto.notes;
    if (updateAddressDto.type != null) address.type = updateAddressDto.type;
    if (updateAddressDto.isDefault != null) address.isDefault = updateAddressDto.isDefault;

    if (hasPin) {
      address.lat = Number(updateAddressDto.lat);
      address.lng = Number(updateAddressDto.lng);
      address.locationConfirmed = updateAddressDto.locationConfirmed !== false;
    } else if (addressTextChanged) {
      // Cambió el texto sin nuevo pin → hay que volver a confirmar en el mapa
      address.lat = null;
      address.lng = null;
      address.locationConfirmed = false;
    } else if (updateAddressDto.locationConfirmed === false) {
      address.locationConfirmed = false;
    }

    return await this.addressRepository.save(address);
  }

  async remove(userId: string, id: number): Promise<void> {
    const address = await this.findOne(userId, id);
    await this.addressRepository.remove(address);
  }

  async setDefault(userId: string, id: number): Promise<Address> {
    await this.addressRepository.update(
      { userId, isDefault: true },
      { isDefault: false },
    );

    const address = await this.findOne(userId, id);
    address.isDefault = true;
    return await this.addressRepository.save(address);
  }

  /**
   * Ubica una dirección en el mapa (Google Geocoding, bias Bogotá/Kennedy).
   * El usuario luego ajusta el pin; no confirma hasta que guarde coords.
   */
  async geocodePreview(addressText: string): Promise<{
    lat: number;
    lng: number;
    formattedAddress?: string;
  }> {
    const q = (addressText || '').trim();
    if (q.length < 4) {
      throw new BadRequestException('Escribe una dirección más completa para ubicarla.');
    }

    const key = (this.config.get<string>('GOOGLE_MAPS_API_KEY') || '').trim();
    if (!key) {
      // Sin API key: centro Kennedy para que igual puedan arrastrar el pin
      this.logger.warn('GOOGLE_MAPS_API_KEY missing — returning default map center');
      return {
        lat: DEFAULT_NEAR.lat,
        lng: DEFAULT_NEAR.lng,
        formattedAddress: q,
      };
    }

    const near = this.restaurantNear();
    const variants = this.geocodeQueryVariants(q);
    for (const variant of variants) {
      const hit = await this.geocodeOnce(variant, key, near);
      if (hit) return hit;
    }

    // No match exacto: igual devolvemos centro local para que ajusten el pin a mano
    this.logger.warn(`Geocode no match for "${q.slice(0, 80)}" — default center`);
    return {
      lat: near.lat,
      lng: near.lng,
      formattedAddress: q,
    };
  }

  private restaurantNear(): { lat: number; lng: number } {
    const lat = Number(this.config.get('RESTAURANT_LAT') || DEFAULT_NEAR.lat);
    const lng = Number(this.config.get('RESTAURANT_LNG') || DEFAULT_NEAR.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return DEFAULT_NEAR;
  }

  private geocodeQueryVariants(address: string): string[] {
    const q = address.trim();
    const out: string[] = [];
    if (!/\b(bogot[aá]|colombia|cundinamarca)\b/i.test(q)) {
      out.push(`${q}, Kennedy, Bogotá, Colombia`);
      out.push(`${q}, Bogotá, Colombia`);
      out.push(`${q}, Colombia`);
    }
    out.push(q);
    return out;
  }

  private async geocodeOnce(
    q: string,
    key: string,
    near: { lat: number; lng: number },
  ): Promise<{ lat: number; lng: number; formattedAddress?: string } | null> {
    const d = 0.18;
    const sw = `${near.lat - d},${near.lng - d}`;
    const ne = `${near.lat + d},${near.lng + d}`;
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', q);
    url.searchParams.set('key', key);
    url.searchParams.set('region', 'co');
    url.searchParams.set('language', 'es');
    url.searchParams.set('components', 'country:CO');
    url.searchParams.set('bounds', `${sw}|${ne}`);

    try {
      const res = await fetch(url.toString());
      const data = (await res.json()) as {
        status?: string;
        results?: Array<{
          formatted_address?: string;
          geometry?: { location?: { lat: number; lng: number } };
          address_components?: Array<{ short_name?: string; types?: string[] }>;
        }>;
      };
      if (data.status !== 'OK' || !data.results?.length) return null;

      for (const result of data.results) {
        const loc = result.geometry?.location;
        if (!loc) continue;
        const lat = Number(loc.lat);
        const lng = Number(loc.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const country = result.address_components?.find((c) =>
          (c.types || []).includes('country'),
        );
        if (country?.short_name && country.short_name !== 'CO') continue;

        const dist = this.haversineKm(near.lat, near.lng, lat, lng);
        if (dist > 25) continue;

        return {
          lat,
          lng,
          formattedAddress: result.formatted_address || q,
        };
      }
      return null;
    } catch (e) {
      this.logger.warn(`Geocode error: ${(e as Error).message}`);
      return null;
    }
  }

  private haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
}
