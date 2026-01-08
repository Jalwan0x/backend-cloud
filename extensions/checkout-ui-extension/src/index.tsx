import React from 'react';
import {
  reactExtension,
  BlockStack,
  Text,
  Divider,
  InlineStack,
  Badge,
  useDeliveryGroups,
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension('purchase.checkout.shipping-option-list.render-after', () => (
  <ShippingBreakdown />
));

function ShippingBreakdown() {
  const deliveryGroups = useDeliveryGroups();

  // Find the selected delivery option across all groups that has our breakdown format
  const breakdownLines: string[] = [];

  // Iterate through all delivery groups to find the selected option with our breakdown
  for (const group of deliveryGroups) {
    if (group.selectedDeliveryOption && group.selectedDeliveryOption.description) {
      const description = group.selectedDeliveryOption.description;
      // Check if description contains bullet points which indicate our formatted breakdown
      if (description.includes('•')) {
        const lines = description.split('\n');
        lines.forEach(line => {
          if (line.trim().startsWith('•')) {
            breakdownLines.push(line.trim().substring(2)); // Remove "• "
          }
        });
      }
    }
  }

  if (breakdownLines.length === 0) {
    return null;
  }

  return (
    <BlockStack spacing="base">
      <Divider />
      <Text size="base" emphasis="strong">
        Shipping Breakdown:
      </Text>
      <BlockStack spacing="tight">
        {breakdownLines.map((line, index) => {
          // Parse line: "Location Name (Days): $Cost"
          // Regex to extract parts: ^(.+) \((.+)\): (.+)$
          const match = line.match(/^(.+) \((.+)\): (.+)$/);

          if (match) {
            const [_, location, time, cost] = match;
            return (
              <InlineStack key={index} spacing="base" alignment="center">
                <BlockStack spacing="none">
                  <Text size="base">{location}</Text>
                  <Text size="small" appearance="subdued">{time}</Text>
                </BlockStack>
                <InlineStack spacing="none" alignment="end">
                  <Badge tone={cost === '$0.00' ? 'success' : undefined}>
                    {cost === '$0.00' ? 'Free' : cost}
                  </Badge>
                </InlineStack>
              </InlineStack>
            );
          }

          // Fallback if parsing fails
          return (
            <Text key={index} size="base">{line}</Text>
          );
        })}
      </BlockStack>
    </BlockStack>
  );
}
