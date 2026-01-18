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
import { UserAddressesService } from './user-addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { Auth } from './decorators/auth.decorator';
import { User } from './entities/user.entity';
import { Request } from 'express';

@ApiTags('User Addresses')
@Controller('auth/addresses')
@Auth()
@ApiBearerAuth()
export class UserAddressesController {
  constructor(private readonly addressesService: UserAddressesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva dirección para el usuario autenticado' })
  @ApiResponse({ status: 201, description: 'Dirección creada exitosamente' })
  create(@Req() req: Request, @Body() createAddressDto: CreateAddressDto) {
    const user = req.user as User;
    return this.addressesService.create(user.id, createAddressDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las direcciones del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de direcciones' })
  findAll(@Req() req: Request) {
    const user = req.user as User;
    return this.addressesService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una dirección específica por ID' })
  @ApiResponse({ status: 200, description: 'Dirección encontrada' })
  @ApiResponse({ status: 404, description: 'Dirección no encontrada' })
  findOne(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as User;
    return this.addressesService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una dirección' })
  @ApiResponse({ status: 200, description: 'Dirección actualizada exitosamente' })
  @ApiResponse({ status: 404, description: 'Dirección no encontrada' })
  update(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    const user = req.user as User;
    return this.addressesService.update(user.id, id, updateAddressDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una dirección' })
  @ApiResponse({ status: 200, description: 'Dirección eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Dirección no encontrada' })
  remove(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as User;
    return this.addressesService.remove(user.id, id);
  }

  @Post(':id/set-default')
  @ApiOperation({ summary: 'Establecer una dirección como predeterminada' })
  @ApiResponse({ status: 200, description: 'Dirección establecida como predeterminada' })
  setDefault(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as User;
    return this.addressesService.setDefault(user.id, id);
  }
}
