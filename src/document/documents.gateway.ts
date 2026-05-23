import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: '*', // In production, set this to your frontend URL
  },
  namespace: 'documents', // Namespace for this feature
})
export class DocumentsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger(DocumentsGateway.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * When a client connects (usually with a JWT token)
   */
  async handleConnection(client: Socket) {
    try {
      // 1. Authenticate the WebSocket connection
      const token =
        client.handshake.auth?.token || client.handshake.query?.token;

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token as string, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // 2. Attach user info to the socket instance
      client.data.user = { userId: payload.sub, email: payload.email };

      this.logger.log(`User ${payload.email} connected`);
    } catch (err) {
      this.logger.error('Invalid WebSocket auth token');
      client.disconnect();
    }
  }

  /**
   * When a client disconnects
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`User disconnected`);
  }

  /**
   * Join a specific document room
   */
  @SubscribeMessage('join_document')
  handleJoinDocument(
    @MessageBody() data: { documentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    // 1. Leave all previous rooms
    const rooms = Array.from(client.rooms);
    rooms.forEach((room) => client.leave(room));

    // 2. Join the specific document room
    client.join(data.documentId);
    this.logger.log(`User joined document: ${data.documentId}`);

    // 3. Notify others in the room that someone joined
    this.server.to(data.documentId).emit('user_joined', {
      userId: client.data.user.userId,
      email: client.data.user.email,
    });
  }

  /**
   * Block update event (Real-time sync)
   */
  @SubscribeMessage('block_update')
  handleBlockUpdate(
    @MessageBody() data: { documentId: string; blockId: string; content: any },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `Block update: ${data.blockId} by ${client.data.user.userId}`,
    );

    // Broadcast the change to everyone in the room EXCEPT the sender
    client.broadcast.emit('block_updated', {
      blockId: data.blockId,
      content: data.content,
      updatedBy: client.data.user.userId,
    });
  }
}
