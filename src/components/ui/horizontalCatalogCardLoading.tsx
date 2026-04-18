import React from 'react';
import { Card, CardBody } from '@heroui/react';

export default function HorizontalCatalogCardLoading() {
  return (
    <Card
      shadow="sm"
      radius="lg"
      classNames={{
        base: 'min-w-0 w-full border border-default-200/80 dark:border-default-100/25',
      }}
    >
      <CardBody className="aspect-[16/10] w-full overflow-hidden p-0">
        <div className="h-full w-full animate-pulse bg-default-200" />
      </CardBody>
    </Card>
  );
}
