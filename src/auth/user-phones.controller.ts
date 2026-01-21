import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserPhonesService } from './user-phones.service';
import { CreatePhoneDto } from './dto/create-phone.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { Auth } from './decorators/auth.decorator';
import { User } from './entities/user.entity';
import { Request } from 'express';
import { transformDatesToBogota } from '../common/utils/date.util';

@ApiTags('User Phones')
@Controller('auth/phones')
@Auth()
@ApiBearerAuth()
export class UserPhonesController {
  constructor(private readonly phonesService: UserPhonesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo teléfono para el usuario autenticado' })
  @ApiResponse({ status: 201, description: 'Teléfono creado exitosamente' })
  async create(@Req() req: Request, @Body() createPhoneDto: CreatePhoneDto) {
    const user = req.user as User;
    const phone = await this.phonesService.create(user.id, createPhoneDto);
    return transformDatesToBogota(phone, ['createdAt', 'updatedAt']);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los teléfonos del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de teléfonos' })
  async findAll(@Req() req: Request) {
    const user = req.user as User;
    const phones = await this.phonesService.findAll(user.id);
    return phones.map(phone => transformDatesToBogota(phone, ['createdAt', 'updatedAt']));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un teléfono específico por ID' })
  @ApiResponse({ status: 200, description: 'Teléfono encontrado' })
  @ApiResponse({ status: 404, description: 'Teléfono no encontrado' })
  async findOne(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as User;
    const phone = await this.phonesService.findOne(user.id, id);
    return transformDatesToBogota(phone, ['createdAt', 'updatedAt']);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un teléfono' })
  @ApiResponse({ status: 200, description: 'Teléfono actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Teléfono no encontrado' })
  async update(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePhoneDto: UpdatePhoneDto,
  ) {
    const user = req.user as User;
    const phone = await this.phonesService.update(user.id, id, updatePhoneDto);
    return transformDatesToBogota(phone, ['createdAt', 'updatedAt']);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un teléfono' })
  @ApiResponse({ status: 200, description: 'Teléfono eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Teléfono no encontrado' })
  async remove(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as User;
    return this.phonesService.remove(user.id, id);
  }

  @Post(':id/set-default')
  @ApiOperation({ summary: 'Establecer un teléfono como predeterminado' })
  @ApiResponse({ status: 200, description: 'Teléfono establecido como predeterminado' })
  async setDefault(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as User;
    const phone = await this.phonesService.setDefault(user.id, id);
    return transformDatesToBogota(phone, ['createdAt', 'updatedAt']);
  }
}
