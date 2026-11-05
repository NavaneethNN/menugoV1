import { z } from 'zod';
import * as schemas from './schemas';

export * from './constants';
export * from './schemas';
export * from './order-state-machine';
export * from './realtime';

// Inferred TypeScript types
export type CreateRestaurantInput = z.infer<typeof schemas.createRestaurantSchema>;
export type UpdateRestaurantInput = z.infer<typeof schemas.updateRestaurantSchema>;
export type Restaurant = z.infer<typeof schemas.restaurantSchema>;

export type CreateCategoryInput = z.infer<typeof schemas.createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof schemas.updateCategorySchema>;
export type ReorderCategoriesInput = z.infer<typeof schemas.reorderCategoriesSchema>;
export type Category = z.infer<typeof schemas.categorySchema>;

export type CreateProductInput = z.infer<typeof schemas.createProductSchema>;
export type UpdateProductInput = z.infer<typeof schemas.updateProductSchema>;
export type ReorderProductsInput = z.infer<typeof schemas.reorderProductsSchema>;
export type Product = z.infer<typeof schemas.productSchema>;

export type CreateTableInput = z.infer<typeof schemas.createTableSchema>;
export type UpdateTableInput = z.infer<typeof schemas.updateTableSchema>;
export type RestaurantTable = z.infer<typeof schemas.restaurantTableSchema>;

export type CreateOrderItemInput = z.infer<typeof schemas.createOrderItemSchema>;
export type CreateOrderInput = z.infer<typeof schemas.createOrderSchema>;
export type PublicCreateOrderInput = z.infer<typeof schemas.publicCreateOrderSchema>;
export type PublicOrderItemInput = z.infer<typeof schemas.publicOrderItemSchema>;
export type UpdateOrderStatusInput = z.infer<typeof schemas.updateOrderStatusSchema>;
export type OrderItem = z.infer<typeof schemas.orderItemSchema>;
export type Order = z.infer<typeof schemas.orderSchema>;

export type AddMemberInput = z.infer<typeof schemas.addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof schemas.updateMemberRoleSchema>;
export type RestaurantMember = z.infer<typeof schemas.restaurantMemberSchema>;

export type InviteStaffInput = z.infer<typeof schemas.inviteStaffSchema>;
export type AddStaffInput = z.infer<typeof schemas.addStaffSchema>;
export type UpdateStaffRoleInput = z.infer<typeof schemas.updateStaffRoleSchema>;
export type TransferOwnershipInput = z.infer<typeof schemas.transferOwnershipSchema>;
export type AcceptInvitationInput = z.infer<typeof schemas.acceptInvitationSchema>;
export type RestaurantInvitation = z.infer<typeof schemas.restaurantInvitationSchema>;
export type StaffAssignableRole = schemas.StaffAssignableRole;

export type CreateStaffWithPinInput = z.infer<typeof schemas.createStaffWithPinSchema>;
export type StaffPinLoginInput = z.infer<typeof schemas.staffPinLoginSchema>;
export type StaffSetPasswordInput = z.infer<typeof schemas.staffSetPasswordSchema>;
export type UpdateStaffPinInput = z.infer<typeof schemas.updateStaffPinSchema>;

