'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { CustomerCinemaOrderingView } from '@/components/cinema/CustomerCinemaOrderingView';

export default function PublicCinemaTheatrePage() {
  const params = useParams();
  const theatreToken = params?.theatreToken as string;

  return <CustomerCinemaOrderingView theatreToken={theatreToken} />;
}
