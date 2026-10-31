'use client'

import type { ComponentProps } from 'react'
import { useMerchantMobile } from '@/lib/use-merchant-mobile'
import Desktop from '@/components/admin/ProdutoFormModalDesktop'
import Mobile from '@/components/admin/ProdutoFormModalMobile'

/** The desktop editor is the original pre-mobile-redesign component. */
export default function ProdutoFormModal(props: ComponentProps<typeof Mobile>) {
  const mobile = useMerchantMobile()
  return mobile ? <Mobile {...props} /> : <Desktop {...props} />
}
