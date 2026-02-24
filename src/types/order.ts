export type ShippingDetails = {
  fullName: string
  phone: string
  addressLine1: string
  addressLine2?: string
  city: string
  region?: string
  postalCode?: string
  country: string
  deliveryNote?: string
}

export type Order = {
  id: string
  userId: string
  items: any[]
  subtotal: number
  shippingCost: number
  tax: number
  discount: number
  total: number
  paymentMethod: string
  gateway: string
  status: string
  shippingDetails?: ShippingDetails
}