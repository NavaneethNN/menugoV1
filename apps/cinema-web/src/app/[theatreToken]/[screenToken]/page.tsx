'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { CustomerCinemaOrderingView } from '@/components/cinema/CustomerCinemaOrderingView';

export default function PublicCinemaScreenPage() {
  const params = useParams();
  const theatreToken = params?.theatreToken as string;
  const screenToken = params?.screenToken as string;

  return (
    <CustomerCinemaOrderingView
      theatreToken={theatreToken}
      screenToken={screenToken}
    />
  );
}
