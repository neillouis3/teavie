import React from 'react';
import { Card, CardBody } from '@heroui/react';

export default function HorizontalCatalogCardLoading() {
  return (
    <Card
      shadow="none"
      radius="lg"
      classNames={{
        base:
          'min-w-0 w-full border border-default-200/45 bg-default-50/90 dark:border-default-100/15 dark:bg-default-50/10',
      }}
    >
      <CardBody className="relative aspect-[16/10] w-full overflow-hidden p-0">
        <div className="h-full w-full animate-pulse bg-default-100 dark:bg-default-100/25" />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-default-300/90 to-transparent dark:from-default-200/40 dark:to-transparent"
          aria-hidden
        />
      </CardBody>
    </Card>
  );
}
