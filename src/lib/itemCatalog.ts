import type { SizeClass } from './types'

const bySize: Record<SizeClass, string[]> = {
  small: ['Alarm clock', 'Baking dish', 'Book', 'Camera', 'Coffee mug', 'Cutlery set', 'Desk lamp', 'Digital scale', 'Drill', 'Family photo album', 'Frying pan', 'Hair dryer', 'Hand mixer', 'Jewelry box', 'Kettle', 'Keyboard', 'Laptop', 'Picture frame', 'Serving bowl', 'Toaster', 'Toolbox', 'Vase'],
  medium: ['Air fryer', 'Bar stool', 'Bedside table', 'Books box', 'Chair', 'Coffee machine', 'Dehumidifier', 'Floor lamp', 'Laundry basket', 'Microwave', 'Office chair', 'Portable fan', 'Printer', 'Side table', 'Suitcase', 'TV', 'Vacuum'],
  large: ['Armchair', 'Bed', 'Bicycle', 'Bookcase', 'Chest freezer', 'Coffee table', 'Desk', 'Dining table', 'Dishwasher', 'Dresser', 'Dryer', 'Filing cabinet', 'Mattress', 'Oven', 'Patio table', 'Refrigerator', 'Sofa', 'TV stand', 'Washing machine'],
  oversize: ['Grand piano', 'Pool table', 'Sectional sofa', 'Treadmill', 'Upright piano', 'Wardrobe'],
}

export const itemCatalog = Object.entries(bySize).flatMap(([size, names]) =>
  names.map((name) => ({ name, size: size as SizeClass })),
)
